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
});
