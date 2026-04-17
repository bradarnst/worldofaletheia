import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestSession } from './auth-session';
import { createCampaignMembershipRepoFromLocals } from './campaign-membership-repo';
import { resolveSearchAccess } from './search-access';

vi.mock('./auth-session', () => ({
  getRequestSession: vi.fn(),
}));

vi.mock('./campaign-membership-repo', () => ({
  createCampaignMembershipRepoFromLocals: vi.fn(),
}));

const getRequestSessionMock = vi.mocked(getRequestSession);
const createCampaignMembershipRepoFromLocalsMock = vi.mocked(createCampaignMembershipRepoFromLocals);

describe('resolveSearchAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses guest public scope when no request session exists', async () => {
    getRequestSessionMock.mockResolvedValue(null);

    await expect(resolveSearchAccess(new Request('https://example.com/api/search?q=star'), {})).resolves.toEqual({
      responseScope: {
        isAuthenticated: false,
        visibility: 'public',
        reason: 'guest',
        campaignAccess: {
          membershipCount: 0,
          gmCount: 0,
        },
      },
    });

    expect(createCampaignMembershipRepoFromLocalsMock).not.toHaveBeenCalled();
  });

  it('keeps authenticated users on public scope when no memberships exist', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', name: 'User One' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    createCampaignMembershipRepoFromLocalsMock.mockResolvedValue({
      listUserCampaignAccess: vi.fn().mockResolvedValue([]),
    } as never);

    await expect(resolveSearchAccess(new Request('https://example.com/api/search?q=star'), {})).resolves.toEqual({
      responseScope: {
        isAuthenticated: true,
        visibility: 'public',
        reason: 'authenticated_no_memberships',
        campaignAccess: {
          membershipCount: 0,
          gmCount: 0,
        },
      },
    });
  });

  it('returns gm-aware scope and repo visibility access for authenticated users with campaign roles', async () => {
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', name: 'User One' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    createCampaignMembershipRepoFromLocalsMock.mockResolvedValue({
      listUserCampaignAccess: vi.fn().mockResolvedValue([
        { campaignSlug: 'brad', role: 'member' },
        { campaignSlug: 'barry', role: 'gm' },
      ]),
    } as never);

    await expect(resolveSearchAccess(new Request('https://example.com/api/search?q=star'), {})).resolves.toEqual({
      responseScope: {
        isAuthenticated: true,
        visibility: 'gm',
        reason: 'authenticated_gm_access',
        campaignAccess: {
          membershipCount: 2,
          gmCount: 1,
        },
      },
      visibilityAccess: {
        memberCampaignSlugs: ['barry', 'brad'],
        gmCampaignSlugs: ['barry'],
      },
    });
  });

  it('fails closed to public scope when campaign access lookup fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getRequestSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', name: 'User One' },
      session: { id: 'session-1', userId: 'user-1', expiresAt: '' },
    });
    createCampaignMembershipRepoFromLocalsMock.mockRejectedValue(new Error('db unavailable'));

    await expect(resolveSearchAccess(new Request('https://example.com/api/search?q=star'), {})).resolves.toEqual({
      responseScope: {
        isAuthenticated: true,
        visibility: 'public',
        reason: 'authorization_unavailable',
        campaignAccess: {
          membershipCount: 0,
          gmCount: 0,
        },
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('search.access.resolve_failed', {
      message: 'db unavailable',
    });
    consoleErrorSpy.mockRestore();
  });
});
