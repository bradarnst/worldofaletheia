// src/lib/campaign-content-asset-handler.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/campaign-page-request-context', () => ({
  createCampaignPageRequestContext: vi.fn(),
}));

import { createCampaignPageRequestContext } from '~/lib/campaign-page-request-context';
import type { CampaignContentSourceClient } from '~/lib/campaign-content-source-boundary';
import { handleCampaignContentAssetRequest } from '~/lib/campaign-content-asset-handler';
import type { CampaignAccessRole } from '~/lib/campaign-gate-policy';

const createCtxMock = vi.mocked(createCampaignPageRequestContext);

interface Scenario {
  viewer: { kind: 'anonymous' } | { kind: 'authenticated'; userId: string; traceId: string };
  role: CampaignAccessRole;
}

function makeSourceClientStub(): CampaignContentSourceClient {
  return {
    listCampaignContent: vi.fn(),
    getCampaignContentItem: vi.fn(),
    getCampaignContentAsset: vi.fn(),
  };
}

function makeRequestContext(scenario: Scenario) {
  return {
    viewer: scenario.viewer,
    getCampaignAccessRole: async () => scenario.role,
  };
}

function notFoundFailure() {
  return {
    ok: false as const,
    reason: 'notFoundOrNotReadable' as const,
    mainSiteStatus: 404 as const,
    retryable: false,
    safeMessage: 'Campaign content not found.' as const,
  };
}

function unavailableFailure() {
  return {
    ok: false as const,
    reason: 'sourceUnavailable' as const,
    mainSiteStatus: 503 as const,
    retryable: true,
    safeMessage: 'Campaign content unavailable.' as const,
  };
}

describe('handleCampaignContentAssetRequest (issue #11)', () => {
  let sourceClient: CampaignContentSourceClient;

  beforeEach(() => {
    vi.resetAllMocks();
    sourceClient = makeSourceClientStub();
  });

  it('serves a readable asset for an anonymous reader on a public-gated campaign', async () => {
    const bytes = new Uint8Array([9, 8, 7]).buffer;
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { bytes, contentType: 'image/png', etag: '"etag-1"' },
    });
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(200);
    expect(await response.arrayBuffer()).toEqual(bytes);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('etag')).toBe('"etag-1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');

    const call = vi.mocked(sourceClient.getCampaignContentAsset).mock.calls[0]?.[0];
    expect(call).toMatchObject({
      campaignSlug: 'sample-campaign',
      assetPath: 'assets/hero.png',
      allowedVisibilities: ['public'],
      actor: { kind: 'anonymous' },
    });
  });

  it('blocks anonymous readers from a campaignMembers-gated campaign before any source fetch', async () => {
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/brad/assets/hero.png'),
      locals: {},
      params: { campaign: 'brad', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/brad/assets/hero.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(sourceClient.getCampaignContentAsset).not.toHaveBeenCalled();
  });

  it('serves a readable asset for a campaign member with member-scoped visibility', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { bytes: new Uint8Array([1]).buffer, contentType: 'image/png', etag: null },
    });
    createCtxMock.mockResolvedValue(
      makeRequestContext({ viewer: { kind: 'authenticated', userId: 'user-1', traceId: 't-1' }, role: 'member' }),
    );

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/brad/assets/hero.png'),
      locals: {},
      params: { campaign: 'brad', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/brad/assets/hero.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(200);
    const call = vi.mocked(sourceClient.getCampaignContentAsset).mock.calls[0]?.[0];
    expect(call).toMatchObject({
      campaignSlug: 'brad',
      assetPath: 'assets/hero.png',
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user-1', traceId: 't-1' },
    });
  });

  it('serves a readable asset for a GM with gm-scoped visibility', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { bytes: new Uint8Array([2]).buffer, contentType: 'image/png', etag: null },
    });
    createCtxMock.mockResolvedValue(
      makeRequestContext({ viewer: { kind: 'authenticated', userId: 'user-2', traceId: 't-2' }, role: 'gm' }),
    );

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/brad/assets/gm-only.png'),
      locals: {},
      params: { campaign: 'brad', path: 'gm-only.png' },
      url: new URL('https://example.com/campaigns/brad/assets/gm-only.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(200);
    const call = vi.mocked(sourceClient.getCampaignContentAsset).mock.calls[0]?.[0];
    expect(call?.allowedVisibilities).toEqual(['public', 'campaignMembers', 'gm']);
  });

  it('returns a generic 404 when the source reports a missing or unreadable asset', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue(notFoundFailure());
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/missing.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'missing.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/missing.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('returns a generic 503 when the source is unavailable or rejects the assertion', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue(unavailableFailure());
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(503);
  });

  it('rejects traversal-like asset paths without calling the source', async () => {
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/..%2fsecret.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: '../secret.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/..%2fsecret.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(sourceClient.getCampaignContentAsset).not.toHaveBeenCalled();
  });

  it('returns 404 when the asset path segment is missing', async () => {
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets'),
      locals: {},
      params: { campaign: 'sample-campaign', path: undefined },
      url: new URL('https://example.com/campaigns/sample-campaign/assets'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(sourceClient.getCampaignContentAsset).not.toHaveBeenCalled();
  });
});
