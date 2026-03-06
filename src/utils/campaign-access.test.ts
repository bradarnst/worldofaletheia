import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth-session', () => ({
  getRequestSession: vi.fn(),
}));

vi.mock('../lib/campaign-membership-repo', () => ({
  createCampaignMembershipRepoFromLocals: vi.fn(),
}));

import {
  canViewCampaignContent,
  canViewCampaignContentAsync,
  createCampaignAccessResolver,
  createCampaignAccessResolverFromRequest,
  getCampaignContentVisibility,
  resolveCampaignContentVisibility,
} from './campaign-access';
import { getRequestSession } from '../lib/auth-session';
import { createCampaignMembershipRepoFromLocals } from '../lib/campaign-membership-repo';

const getRequestSessionMock = vi.mocked(getRequestSession);
const createRepoMock = vi.mocked(createCampaignMembershipRepoFromLocals);

describe('campaign access resolver', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows public visibility without membership', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: undefined,
    });

    expect(
      canViewCampaignContent({
        visibility: 'public',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(true);
  });

  it('denies campaignMembers visibility when no session cookie exists', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: JSON.stringify({ dev123: { campaigns: ['brad'] } }),
    });

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('allows campaignMembers visibility for mapped campaign membership', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: 'aletheia-dev-session=dev123',
      membershipConfigRaw: JSON.stringify({
        dev123: { campaigns: ['brad', 'sample-campaign'] },
      }),
    });

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(true);

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'barry',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('treats malformed cookie encoding as unauthenticated without throwing', () => {
    const createResolver = () =>
      createCampaignAccessResolver({
        cookieHeader: 'aletheia-dev-session=%E0%A4%A',
        membershipConfigRaw: JSON.stringify({ dev123: { campaigns: ['brad'] } }),
      });

    expect(createResolver).not.toThrow();

    const resolver = createResolver();
    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('treats non-object membership config JSON as unauthenticated without throwing', () => {
    const createResolver = () =>
      createCampaignAccessResolver({
        cookieHeader: 'aletheia-dev-session=dev123',
        membershipConfigRaw: '"not-an-object"',
      });

    expect(createResolver).not.toThrow();

    const resolver = createResolver();
    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('gracefully handles truncated or invalid membership JSON', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: 'aletheia-dev-session=dev123',
      membershipConfigRaw: '{"dev123": ',
    });

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('uses first matching cookie when duplicate cookie names exist', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: 'aletheia-dev-session=dev123; aletheia-dev-session=dev999',
      membershipConfigRaw: JSON.stringify({
        dev123: { campaigns: ['brad'] },
        dev999: { campaigns: ['barry'] },
      }),
    });

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(true);

    expect(
      canViewCampaignContent({
        visibility: 'campaignMembers',
        campaignSlug: 'barry',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('uses content visibility when campaign access config is missing', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: undefined,
    });

    expect(
      getCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'campaignMembers',
        access: resolver,
      }),
    ).toBe('campaignMembers');

    expect(
      getCampaignContentVisibility({
        campaignSlug: 'barry',
        contentVisibility: 'public',
        access: resolver,
      }),
    ).toBe('public');
  });

  it('applies per-campaign config when it tightens visibility to campaignMembers', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: undefined,
      campaignAccessConfigRaw: JSON.stringify({
        campaigns: {
          brad: { visibility: 'campaignMembers' },
        },
      }),
    });

    expect(
      getCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'public',
        access: resolver,
      }),
    ).toBe('campaignMembers');
  });

  it('does not allow config to downgrade campaignMembers content to public', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: undefined,
      campaignAccessConfigRaw: JSON.stringify({
        campaigns: {
          brad: { visibility: 'public' },
        },
      }),
    });

    expect(
      getCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'campaignMembers',
        access: resolver,
      }),
    ).toBe('campaignMembers');
  });

  it('ignores invalid campaign access config shape and preserves content visibility', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: null,
      membershipConfigRaw: undefined,
      campaignAccessConfigRaw: JSON.stringify({ campaigns: ['bad-shape'] }),
    });

    expect(
      getCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'public',
        access: resolver,
      }),
    ).toBe('public');
  });

  it('keeps explicit session visibility at campaignMembers when campaign default is gm', () => {
    expect(
      resolveCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'campaignMembers',
        campaignVisibility: 'gm',
      }),
    ).toBe('campaignMembers');
  });

  it('tightens public session visibility when campaign default is gm', () => {
    expect(
      resolveCampaignContentVisibility({
        campaignSlug: 'brad',
        contentVisibility: 'public',
        campaignVisibility: 'gm',
      }),
    ).toBe('gm');
  });

  it('enforces gm visibility using campaign gm assignment mapping in legacy resolver', () => {
    const resolver = createCampaignAccessResolver({
      cookieHeader: 'aletheia-dev-session=jim',
      membershipConfigRaw: JSON.stringify({
        jim: { campaigns: ['brad'] },
      }),
      gmAssignmentsConfigRaw: JSON.stringify({
        brad: { userId: 'jim' },
      }),
    });

    expect(
      canViewCampaignContent({
        visibility: 'gm',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).toBe(true);

    expect(
      canViewCampaignContent({
        visibility: 'gm',
        campaignSlug: 'barry',
        access: resolver,
      }),
    ).toBe(false);
  });

  it('allows gm users to access campaignMembers content in async resolver', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'gm-user', email: 'gm@example.com', name: 'GM User' },
      session: { id: 'session-1', userId: 'gm-user', expiresAt: '' },
    });
    createRepoMock.mockReturnValue({
      isUserMemberOfCampaign: vi.fn().mockResolvedValue(false),
      listCampaignMemberships: vi.fn(),
      seedFromMembershipMap: vi.fn(),
    } as unknown as ReturnType<typeof createCampaignMembershipRepoFromLocals>);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad', {
        headers: { cookie: 'better-auth.session_token=abc123' },
      }),
      locals: {},
      membershipConfigRaw: undefined,
      gmAssignmentsConfigRaw: JSON.stringify({
        brad: { userId: 'gm-user' },
      }),
    });

    await expect(
      canViewCampaignContentAsync({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(true);
  });

  it('denies gm visibility for authenticated non-gm users', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'member-user', email: 'member@example.com', name: 'Member User' },
      session: { id: 'session-1', userId: 'member-user', expiresAt: '' },
    });
    createRepoMock.mockReturnValue({
      isUserMemberOfCampaign: vi.fn().mockResolvedValue(true),
      listCampaignMemberships: vi.fn(),
      seedFromMembershipMap: vi.fn(),
    } as unknown as ReturnType<typeof createCampaignMembershipRepoFromLocals>);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad', {
        headers: { cookie: 'better-auth.session_token=abc123' },
      }),
      locals: {},
      membershipConfigRaw: undefined,
      gmAssignmentsConfigRaw: JSON.stringify({
        brad: { userId: 'gm-user' },
      }),
    });

    await expect(
      canViewCampaignContentAsync({
        visibility: 'gm',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(false);
  });

  it('allows campaignMembers content when authenticated user has membership in D1', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', name: 'User One' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    createRepoMock.mockReturnValue({
      isUserMemberOfCampaign: vi.fn().mockResolvedValue(true),
      listCampaignMemberships: vi.fn(),
      seedFromMembershipMap: vi.fn(),
    } as unknown as ReturnType<typeof createCampaignMembershipRepoFromLocals>);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad', {
        headers: { cookie: 'better-auth.session_token=abc123' },
      }),
      locals: {},
      membershipConfigRaw: undefined,
    });

    await expect(
      canViewCampaignContentAsync({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(true);
  });

  it('denies campaignMembers content when session resolution fails and fallback is disabled', async () => {
    getRequestSessionMock.mockResolvedValue(null);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad'),
      locals: {},
      membershipConfigRaw: JSON.stringify({ dev123: { campaigns: ['brad'] } }),
      allowLegacyEnvFallback: false,
    });

    await expect(
      canViewCampaignContentAsync({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(false);
  });

  it('uses legacy map fallback when session missing and fallback is explicitly enabled', async () => {
    getRequestSessionMock.mockResolvedValue(null);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad', {
        headers: { cookie: 'aletheia-dev-session=dev123' },
      }),
      locals: {},
      membershipConfigRaw: JSON.stringify({ dev123: { campaigns: ['brad'] } }),
      gmAssignmentsConfigRaw: JSON.stringify({ brad: { userId: 'dev123' } }),
      allowLegacyEnvFallback: true,
    });

    await expect(
      canViewCampaignContentAsync({
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(true);

    await expect(
      canViewCampaignContentAsync({
        visibility: 'gm',
        campaignSlug: 'brad',
        access: resolver,
      }),
    ).resolves.toBe(true);
  });
});
