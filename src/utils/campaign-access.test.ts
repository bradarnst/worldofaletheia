import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/auth-session', () => ({
  getRequestSession: vi.fn(),
}));

vi.mock('~/lib/campaign-membership-repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/campaign-membership-repo')>();
  return {
    ...actual,
    createCampaignMembershipRepoFromLocals: vi.fn(),
  };
});

import { createCampaignAccessResolverFromRequest } from '@utils/campaign-access';
import { getRequestSession } from '~/lib/auth-session';
import { CampaignMembershipRepo, createCampaignMembershipRepoFromLocals } from '~/lib/campaign-membership-repo';

const getRequestSessionMock = vi.mocked(getRequestSession);
const createRepoMock = vi.mocked(createCampaignMembershipRepoFromLocals);

function createMembershipRepoMock(input: { isMember: boolean; isGm: boolean }) {
  const repo = new CampaignMembershipRepo({
    prepare() {
      throw new Error('Unexpected database access in campaign access unit test.');
    },
  });
  const isUserMemberOfCampaign = vi.spyOn(repo, 'isUserMemberOfCampaign').mockResolvedValue(input.isMember);
  const isUserGmOfCampaign = vi.spyOn(repo, 'isUserGmOfCampaign').mockResolvedValue(input.isGm);

  return { repo, isUserMemberOfCampaign, isUserGmOfCampaign };
}

describe('campaign request access resolver', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves campaign membership and GM role from Better Auth and D1', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'gm@example.com', name: 'Campaign GM' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    const { repo } = createMembershipRepoMock({ isMember: true, isGm: true });
    createRepoMock.mockResolvedValue(repo);

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
    const { repo, isUserMemberOfCampaign, isUserGmOfCampaign } = createMembershipRepoMock({
      isMember: true,
      isGm: false,
    });
    createRepoMock.mockResolvedValue(repo);

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
