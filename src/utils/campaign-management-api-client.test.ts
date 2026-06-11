import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CampaignApiError,
  addCampaignMember,
  buildCampaignAdminCapabilityUrl,
  buildCampaignMembersUrl,
  getCampaignAdminCapability,
  listCampaignMembers,
  revokeCampaignMember,
  updateCampaignMember,
} from '@utils/campaign-management-api-client';

describe('campaign management API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds encoded public campaign API URLs only', () => {
    expect(buildCampaignAdminCapabilityUrl('crown fall')).toBe('/api/v1/campaigns/crown%20fall/admin-capability');
    expect(buildCampaignMembersUrl({ campaignSlug: 'crown/fall', role: 'gm', limit: 25, cursor: 'user:next' })).toBe(
      '/api/v1/campaigns/crown%2Ffall/members?role=gm&limit=25&cursor=user%3Anext',
    );
    expect(buildCampaignMembersUrl({ campaignSlug: 'crownfall' })).toBe('/api/v1/campaigns/crownfall/members');
  });

  it('calls only documented public campaign endpoints', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          campaignSlug: 'crownfall',
          actor: { userId: 'user_1', displayName: 'Mira' },
          canAdministerUsers: true,
          capabilities: ['user-admin'],
          source: 'campaign-gm',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getCampaignAdminCapability('crownfall');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/campaigns/crownfall/admin-capability', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('/api/v1/admin');
  });

  it('sends expected methods, JSON bodies, credentials, and no Cloudflare Access headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ campaignSlug: 'crownfall', items: [], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            member: { userId: 'user_2', displayName: null, email: 'tamsin@example.invalid', role: 'member' },
            outcome: 'created',
            confirmationMessage: 'Campaign membership created.',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            member: { userId: 'user_2', displayName: null, email: 'tamsin@example.invalid', role: 'gm' },
            outcome: 'updated',
            confirmationMessage: 'Campaign membership updated.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            revokedMembership: { campaignSlug: 'crownfall', userId: 'user_2', role: 'gm' },
            outcome: 'revoked',
            confirmationMessage: 'Campaign membership revoked.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await listCampaignMembers({ campaignSlug: 'crownfall', limit: 100 });
    await addCampaignMember({ campaignSlug: 'crownfall', email: 'tamsin@example.invalid', role: 'member' });
    await updateCampaignMember({ campaignSlug: 'crownfall', userId: 'user/2', role: 'gm', reason: 'Promoted.' });
    await revokeCampaignMember({ campaignSlug: 'crownfall', userId: 'user/2', reason: 'Left table.' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/campaigns/crownfall/members?limit=100',
      '/api/v1/campaigns/crownfall/members',
      '/api/v1/campaigns/crownfall/members/user%2F2',
      '/api/v1/campaigns/crownfall/members/user%2F2',
    ]);

    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'PUT', 'DELETE']);

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(init?.headers).not.toHaveProperty('CF-Access-Jwt-Assertion');
    }

    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ email: 'tamsin@example.invalid', role: 'member' }));
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ role: 'gm', reason: 'Promoted.' }));
    expect(fetchMock.mock.calls[3]?.[1]?.body).toBe(JSON.stringify({ reason: 'Left table.' }));
  });

  it('maps JSON API errors with status and request id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'conflict', message: 'Already a member.', requestId: 'req_1' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(addCampaignMember({ campaignSlug: 'crownfall', email: 'mira@example.invalid', role: 'member' })).rejects.toMatchObject({
      status: 409,
      error: 'conflict',
      message: 'Already a member.',
      requestId: 'req_1',
    });
  });

  it('maps non-JSON failures gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503, statusText: 'Service Unavailable' })));

    await expect(listCampaignMembers({ campaignSlug: 'crownfall' })).rejects.toBeInstanceOf(CampaignApiError);
    await expect(listCampaignMembers({ campaignSlug: 'crownfall' })).rejects.toMatchObject({
      status: 503,
      error: 'request_failed',
      message: 'Service Unavailable',
    });
  });
});
