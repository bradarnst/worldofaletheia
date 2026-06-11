import { describe, expect, it } from 'vitest';
import { CampaignMembershipRepo } from './campaign-membership-repo';
import type { D1DatabaseLike } from './d1';

function createDbMock(overrides: {
  first?: (query: string, values: unknown[]) => Promise<Record<string, unknown> | null>;
  all?: (query: string, values: unknown[]) => Promise<{ results: Record<string, unknown>[] }>;
  run?: (query: string, values: unknown[]) => Promise<unknown>;
}): D1DatabaseLike {
  return {
    prepare(query: string) {
      let boundValues: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return this;
        },
        first<T = Record<string, unknown>>() {
          if (!overrides.first) {
            return Promise.resolve(null as T | null);
          }

          return overrides.first(query, boundValues).then((result) => result as T | null);
        },
        all<T = Record<string, unknown>>() {
          if (!overrides.all) {
            return Promise.resolve({ results: [] as T[] });
          }

          return overrides.all(query, boundValues).then((result) => ({
            results: result.results as T[],
          }));
        },
        run() {
          return overrides.run ? overrides.run(query, boundValues) : Promise.resolve({});
        },
      };
    },
  };
}

describe('CampaignMembershipRepo', () => {
  it('returns true when membership row exists', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async (query) => {
          expect(query).toContain("role IN ('member', 'gm')");
          return { user_id: 'user-1', campaign_slug: 'brad' };
        },
      }),
    );

    await expect(repo.isUserMemberOfCampaign('user-1', 'brad')).resolves.toBe(true);
  });

  it('returns false when membership row does not exist', async () => {
    const repo = new CampaignMembershipRepo(createDbMock({ first: async () => null }));

    await expect(repo.isUserMemberOfCampaign('user-2', 'barry')).resolves.toBe(false);
  });

  it('lists memberships mapped to domain shape', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async () => ({
          results: [
            { user_id: 'user-1', campaign_slug: 'barry' },
            { user_id: 'user-1', campaign_slug: 'brad' },
          ],
        }),
      }),
    );

    await expect(repo.listCampaignMemberships('user-1')).resolves.toEqual([
      { userId: 'user-1', campaignSlug: 'barry' },
      { userId: 'user-1', campaignSlug: 'brad' },
    ]);
  });

  it('lists per-campaign access roles for a user', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async (query, values) => {
          expect(query).toContain('SELECT campaign_slug, role');
          expect(query).toContain("role IN ('member', 'gm')");
          expect(values).toEqual(['user-1']);

          return {
            results: [
              { campaign_slug: 'barry', role: 'gm' },
              { campaign_slug: 'brad', role: 'member' },
            ],
          };
        },
      }),
    );

    await expect(repo.listUserCampaignAccess('user-1')).resolves.toEqual([
      { campaignSlug: 'barry', role: 'gm' },
      { campaignSlug: 'brad', role: 'member' },
    ]);
  });

  it('propagates database errors to caller', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async () => {
          throw new Error('db unavailable');
        },
      }),
    );

    await expect(repo.isUserMemberOfCampaign('user-1', 'brad')).rejects.toThrow('db unavailable');
  });

  it('returns true when gm assignment row exists', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async (query, values) => {
          expect(query).toContain('FROM campaign_memberships');
          expect(query).toContain("role = 'gm'");
          expect(values).toEqual(['brad', 'gm-user']);
          return { user_id: 'gm-user' };
        },
      }),
    );

    await expect(repo.isUserGmOfCampaign('gm-user', 'brad')).resolves.toBe(true);
  });

  it('returns false when gm assignment row does not exist', async () => {
    const repo = new CampaignMembershipRepo(createDbMock({ first: async () => null }));

    await expect(repo.isUserGmOfCampaign('member-user', 'brad')).resolves.toBe(false);
  });

  it('lists gm user ids for a campaign', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async (query, values) => {
          expect(query).toContain('FROM campaign_memberships');
          expect(query).toContain("role = 'gm'");
          expect(values).toEqual(['brad']);

          return {
            results: [{ user_id: 'gm-a' }, { user_id: 'gm-b' }],
          };
        },
      }),
    );

    await expect(repo.listCampaignGms('brad')).resolves.toEqual(['gm-a', 'gm-b']);
  });

  it('counts gm memberships for a campaign', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async (query, values) => {
          expect(query).toContain('COUNT(*) AS gm_count');
          expect(query).toContain("role = 'gm'");
          expect(values).toEqual(['brad']);
          return { gm_count: 2 };
        },
      }),
    );

    await expect(repo.countCampaignGms('brad')).resolves.toBe(2);
  });

  it('lists campaign members joined to Better Auth users', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async (query, values) => {
          expect(query).toContain('INNER JOIN "user" u ON u.id = m.user_id');
          expect(query).toContain('m.campaign_slug = ?1');
          expect(values).toEqual(['brad', '', 3]);

          return {
            results: [
              {
                user_id: 'user-a',
                display_name: 'Mira Stone',
                email: 'mira@example.invalid',
                role: 'gm',
                joined_at: '2026-05-25T10:00:00Z',
                updated_at: '2026-06-03T15:00:00Z',
              },
              {
                user_id: 'user-b',
                display_name: null,
                email: 'rook@example.invalid',
                role: 'member',
                joined_at: '2026-05-26T10:00:00Z',
                updated_at: null,
              },
              {
                user_id: 'user-c',
                display_name: 'Next Page',
                email: 'next@example.invalid',
                role: 'member',
                joined_at: '2026-05-27T10:00:00Z',
                updated_at: null,
              },
            ],
          };
        },
      }),
    );

    await expect(repo.listCampaignMembers({ campaignSlug: 'brad', limit: 2 })).resolves.toEqual({
      items: [
        {
          userId: 'user-a',
          displayName: 'Mira Stone',
          email: 'mira@example.invalid',
          role: 'gm',
          joinedAt: '2026-05-25T10:00:00Z',
          updatedAt: '2026-06-03T15:00:00Z',
        },
        {
          userId: 'user-b',
          displayName: null,
          email: 'rook@example.invalid',
          role: 'member',
          joinedAt: '2026-05-26T10:00:00Z',
          updatedAt: null,
        },
      ],
      nextCursor: 'user-b',
    });
  });

  it('resolves a user by exact canonical email without global search', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async (query, values) => {
          expect(query).toContain('email = ?1');
          expect(query).not.toContain('email_canonical');
          expect(query).not.toContain('lower(email) = ?1');
          expect(query).toContain('LIMIT 2');
          expect(values).toEqual(['mira@example.invalid']);

          return {
            results: [
              {
                user_id: 'user-a',
                display_name: 'Mira Stone',
                email: 'Mira@Example.Invalid',
              },
            ],
          };
        },
      }),
    );

    await expect(repo.findUserByExactEmail('mira@example.invalid')).resolves.toEqual({
      status: 'found',
      user: {
        userId: 'user-a',
        displayName: 'Mira Stone',
        email: 'Mira@Example.Invalid',
      },
    });
  });

  it('fails closed when exact email resolution finds duplicates', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        all: async () => ({
          results: [
            { user_id: 'user-a', display_name: 'A', email: 'a@example.invalid' },
            { user_id: 'user-b', display_name: 'B', email: 'b@example.invalid' },
          ],
        }),
      }),
    );

    await expect(repo.findUserByExactEmail('duplicate@example.invalid')).resolves.toEqual({ status: 'duplicate' });
  });

  it('returns unchanged without writing when upserting the same role', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async (query, values) => {
          expect(query).toContain('SELECT role');
          expect(values).toEqual(['brad', 'user-a']);
          return { role: 'member' };
        },
        run: async () => {
          throw new Error('write should not run');
        },
      }),
    );

    await expect(repo.upsertCampaignMember('brad', 'user-a', 'member')).resolves.toBe('unchanged');
  });

  it('updates existing campaign member role', async () => {
    const writes: unknown[][] = [];
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async () => ({ role: 'member' }),
        run: async (query, values) => {
          expect(query).toContain('UPDATE campaign_memberships');
          writes.push(values);
          return {};
        },
      }),
    );

    await expect(repo.upsertCampaignMember('brad', 'user-a', 'gm')).resolves.toBe('updated');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.slice(0, 3)).toEqual(['brad', 'user-a', 'gm']);
  });

  it('inserts new campaign member role', async () => {
    const writes: unknown[][] = [];
    const repo = new CampaignMembershipRepo(
      createDbMock({
        first: async () => null,
        run: async (query, values) => {
          expect(query).toContain('INSERT INTO campaign_memberships');
          expect(query).toContain('ON CONFLICT(user_id, campaign_slug)');
          writes.push(values);
          return {};
        },
      }),
    );

    await expect(repo.upsertCampaignMember('brad', 'user-a', 'member')).resolves.toBe('created');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.slice(1, 4)).toEqual(['user-a', 'brad', 'member']);
  });

  it('creates a campaign member without updating existing rows', async () => {
    const writes: unknown[][] = [];
    const repo = new CampaignMembershipRepo(
      createDbMock({
        run: async (query, values) => {
          expect(query).toContain('INSERT OR IGNORE INTO campaign_memberships');
          expect(query).not.toContain('DO UPDATE');
          writes.push(values);
          return { meta: { changes: 1 } };
        },
      }),
    );

    await expect(repo.createCampaignMember('brad', 'user-a', 'member')).resolves.toBe('created');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.slice(1, 4)).toEqual(['user-a', 'brad', 'member']);
  });

  it('reports existing campaign membership without updating role', async () => {
    const repo = new CampaignMembershipRepo(
      createDbMock({
        run: async (query) => {
          expect(query).toContain('INSERT OR IGNORE INTO campaign_memberships');
          expect(query).not.toContain('DO UPDATE');
          return { meta: { changes: 0 } };
        },
      }),
    );

    await expect(repo.createCampaignMember('brad', 'user-a', 'gm')).resolves.toBe('already_exists');
  });
});
