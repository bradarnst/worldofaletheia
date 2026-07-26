import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth-session', () => ({
  getRequestSession: vi.fn(),
}));

vi.mock('../lib/campaign-membership-repo', () => ({
  createCampaignMembershipRepoFromLocals: vi.fn(),
}));

import { createCampaignAccessResolverFromRequest } from './campaign-access';
import { getRequestSession } from '../lib/auth-session';
import { createCampaignMembershipRepoFromLocals } from '../lib/campaign-membership-repo';

const getRequestSessionMock = vi.mocked(getRequestSession);
const createRepoMock = vi.mocked(createCampaignMembershipRepoFromLocals);
type MockCampaignMembershipRepo = Awaited<ReturnType<typeof createCampaignMembershipRepoFromLocals>>;

describe('campaign request access resolver', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves campaign membership and GM role from Better Auth and D1', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'gm@example.com', name: 'Campaign GM' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    createRepoMock.mockResolvedValue({
      isUserMemberOfCampaign: vi.fn().mockResolvedValue(true),
      isUserGmOfCampaign: vi.fn().mockResolvedValue(true),
    } as unknown as MockCampaignMembershipRepo);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad'),
      locals: {},
      membershipConfigRaw: undefined,
    });

    await expect(resolver.hasCampaignAccess('brad')).resolves.toEqual({ isMember: true, isGm: true });
  });

  it('fails closed when no authenticated session exists', async () => {
    getRequestSessionMock.mockResolvedValue(null);
    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad', {
        headers: { cookie: 'aletheia-dev-session=dev-user' },
      }),
      locals: {},
      membershipConfigRaw: JSON.stringify({ 'dev-user': { campaigns: { brad: 'gm' } } }),
    });

    await expect(resolver.hasCampaignAccess('brad')).resolves.toEqual({ isMember: false, isGm: false });
    expect(createRepoMock).not.toHaveBeenCalled();
  });

  it('supports the explicit local-development membership fallback', async () => {
    getRequestSessionMock.mockResolvedValue(null);
    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('http://localhost:4321/campaigns/brad', {
        headers: { cookie: 'aletheia-dev-session=dev-user' },
      }),
      locals: {},
      membershipConfigRaw: JSON.stringify({ 'dev-user': { campaigns: { brad: 'gm' } } }),
      allowLegacyEnvFallback: true,
    });

    await expect(resolver.hasCampaignAccess('brad')).resolves.toEqual({ isMember: true, isGm: true });
  });

  it('caches membership decisions per campaign during a request', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'member@example.com', name: 'Campaign Member' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    const isUserMemberOfCampaign = vi.fn().mockResolvedValue(true);
    const isUserGmOfCampaign = vi.fn().mockResolvedValue(false);
    createRepoMock.mockResolvedValue({
      isUserMemberOfCampaign,
      isUserGmOfCampaign,
    } as unknown as MockCampaignMembershipRepo);

    const resolver = createCampaignAccessResolverFromRequest({
      request: new Request('https://example.com/campaigns/brad'),
      locals: {},
      membershipConfigRaw: undefined,
    });

    await resolver.hasCampaignAccess('brad');
    await resolver.hasCampaignAccess('brad');

    expect(isUserMemberOfCampaign).toHaveBeenCalledTimes(1);
    expect(isUserGmOfCampaign).toHaveBeenCalledTimes(1);
  });
});
