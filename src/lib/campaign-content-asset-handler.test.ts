// src/lib/campaign-content-asset-handler.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/campaign-page-request-context', () => ({
  createCampaignPageRequestContext: vi.fn(),
}));

import { createCampaignPageRequestContext } from '~/lib/campaign-page-request-context';
import {
  RUNTIME_ASSERTION_HEADER,
  RUNTIME_ASSERTION_SIGNATURE_HEADER,
  createCampaignContentSourceClient,
  type CampaignContentSourceFailure,
  type CampaignContentSourceClient,
} from '~/lib/campaign-content-source-boundary';
import { handleCampaignContentAssetRequest as handleCampaignContentAssetRequestImpl } from '~/lib/campaign-content-asset-handler';
import { parseCampaignGateManifest, type CampaignAccessRole } from '~/lib/campaign-gate-policy';

const createCtxMock = vi.mocked(createCampaignPageRequestContext);
const testGateManifest = parseCampaignGateManifest({
  'sample-campaign': 'public',
  brad: 'campaignMembers',
});

function handleCampaignContentAssetRequest(
  input: Parameters<typeof handleCampaignContentAssetRequestImpl>[0],
): Promise<Response> {
  return handleCampaignContentAssetRequestImpl({ ...input, gateManifest: testGateManifest });
}

interface Scenario {
  viewer: { kind: 'anonymous' } | { kind: 'authenticated'; userId: string; traceId: string };
  role: CampaignAccessRole;
}

function makeSourceClientStub(): CampaignContentSourceClient {
  return {
    listCampaignSurfaces: vi.fn(),
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

function sourceFailure(
  reason:
    | 'notFoundOrNotReadable'
    | 'integrationRejected'
    | 'invalidRequest'
    | 'rateLimited'
    | 'sourceUnavailable'
    | 'networkFailure'
    | 'validationFailure',
): CampaignContentSourceFailure {
  const mainSiteStatus: 404 | 503 = reason === 'notFoundOrNotReadable' ? 404 : 503;
  return {
    ok: false as const,
    reason,
    mainSiteStatus,
    retryable: reason === 'rateLimited' || reason === 'sourceUnavailable' || reason === 'networkFailure',
    safeMessage: mainSiteStatus === 404 ? 'Campaign content not found.' as const : 'Campaign content unavailable.' as const,
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
      value: { body: bytes, contentType: 'image/png', etag: '"etag-1"' },
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
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');

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

  it('warns but serves a source-available asset to a member when the manifest entry is missing', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { body: new Uint8Array([1]).buffer, contentType: 'image/png', etag: null },
    });
    createCtxMock.mockResolvedValue(
      makeRequestContext({ viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' }, role: 'member' }),
    );

    const response = await handleCampaignContentAssetRequestImpl({
      request: new Request('https://example.com/campaigns/ghost/assets/hero.png'),
      locals: {},
      params: { campaign: 'ghost', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/ghost/assets/hero.png'),
      gateManifest: parseCampaignGateManifest({}),
      createSourceClient: () => sourceClient,
      logger,
    });

    expect(response.status).toBe(200);
    expect(sourceClient.getCampaignContentAsset).toHaveBeenCalledWith(
      expect.objectContaining({ campaignSlug: 'ghost', allowedVisibilities: ['public', 'campaignMembers'] }),
    );
    expect(logger.warn).toHaveBeenCalledWith('campaign.gate_manifest.missing_entry', expect.objectContaining({ campaignSlug: 'ghost' }));
  });

  it('fails closed before source fetch when a required asset gate is missing', async () => {
    createCtxMock.mockResolvedValue(
      makeRequestContext({ viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' }, role: 'member' }),
    );

    const response = await handleCampaignContentAssetRequestImpl({
      request: new Request('https://example.com/campaigns/ghost/assets/hero.png'),
      locals: {},
      params: { campaign: 'ghost', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/ghost/assets/hero.png'),
      gateManifest: parseCampaignGateManifest({}, { source: 'registry' }),
      requireKnownCampaignGate: true,
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(sourceClient.getCampaignContentAsset).not.toHaveBeenCalled();
  });

  it('fails closed before source fetch when a required asset gate is malformed', async () => {
    createCtxMock.mockResolvedValue(
      makeRequestContext({ viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' }, role: 'member' }),
    );

    const response = await handleCampaignContentAssetRequestImpl({
      request: new Request('https://example.com/campaigns/bad-registry-gate/assets/hero.png'),
      locals: {},
      params: { campaign: 'bad-registry-gate', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/bad-registry-gate/assets/hero.png'),
      gateManifest: parseCampaignGateManifest({ 'bad-registry-gate': 'gm' }, { source: 'registry' }),
      requireKnownCampaignGate: true,
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(404);
    expect(sourceClient.getCampaignContentAsset).not.toHaveBeenCalled();
  });

  it('serves a readable asset for a campaign member with member-scoped visibility', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { body: new Uint8Array([1]).buffer, contentType: 'image/png', etag: null },
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
      value: { body: new Uint8Array([2]).buffer, contentType: 'image/png', etag: null },
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
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue(sourceFailure('notFoundOrNotReadable'));
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
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue(sourceFailure('sourceUnavailable'));
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

  it.each([
    'integrationRejected',
    'invalidRequest',
    'rateLimited',
    'sourceUnavailable',
    'networkFailure',
    'validationFailure',
  ] as const)('fails closed without source details for %s asset failures', async (reason) => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue(sourceFailure(reason));
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
    expect([...response.headers.values()].join(' ')).not.toContain('woa-admin');
  });

  it('fails closed when the source client unexpectedly throws', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockRejectedValue(new Error('secret source diagnostic'));
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      createSourceClient: () => sourceClient,
      logger: { warn: vi.fn(), error: vi.fn() },
    });

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
  });

  it('falls back to octet-stream for executable or unsafe source content types', async () => {
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { body: new Uint8Array([60]).buffer, contentType: 'text/html; charset=utf-8', etag: null },
    });
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/page.html'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'page.html' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/page.html'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('streams readable source bodies through the main-site response', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    });
    vi.mocked(sourceClient.getCampaignContentAsset).mockResolvedValue({
      ok: true,
      value: { body, contentType: 'image/webp', etag: null },
    });
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.webp'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.webp' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.webp'),
      createSourceClient: () => sourceClient,
    });

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('does not leak runtime assertion values or headers into the browser asset response', async () => {
    const captured = { assertion: '', signature: '' };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      captured.assertion = headers.get(RUNTIME_ASSERTION_HEADER) ?? '';
      captured.signature = headers.get(RUNTIME_ASSERTION_SIGNATURE_HEADER) ?? '';
      return new Response(new Uint8Array([7, 7]).buffer, { status: 200, headers: { 'content-type': 'image/png' } });
    });
    createCtxMock.mockResolvedValue(makeRequestContext({ viewer: { kind: 'anonymous' }, role: 'anonymous' }));

    const response = await handleCampaignContentAssetRequest({
      request: new Request('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      locals: {},
      params: { campaign: 'sample-campaign', path: 'hero.png' },
      url: new URL('https://example.com/campaigns/sample-campaign/assets/hero.png'),
      createSourceClient: () =>
        createCampaignContentSourceClient({
          config: {
            baseUrl: 'https://woa-admin.example.invalid',
            assertionSecret: 'test-secret',
            assertionAudience: 'woa-admin:campaign-content:v1',
          },
          fetch: fetchMock,
        }),
    });

    const body = String.fromCharCode(...new Uint8Array(await response.arrayBuffer()));
    const headerText = [...response.headers.entries()].flat().join('\n');
    expect(captured.assertion).toBeTruthy();
    expect(captured.signature).toBeTruthy();
    expect(`${headerText}\n${body}`).not.toContain(captured.assertion);
    expect(`${headerText}\n${body}`).not.toContain(captured.signature);
    expect(headerText).not.toContain(RUNTIME_ASSERTION_HEADER);
    expect(headerText).not.toContain(RUNTIME_ASSERTION_SIGNATURE_HEADER);
    expect(headerText).not.toContain('woa-admin:campaign-content:v1');
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
