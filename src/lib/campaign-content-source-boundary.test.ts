import { describe, expect, it, vi } from 'vitest';
import {
  ASSERTION_EXPIRY_SECONDS,
  CAMPAIGN_CONTENT_ASSET_FETCH_TIMEOUT_MS,
  RUNTIME_ASSERTION_HEADER,
  RUNTIME_ASSERTION_SIGNATURE_HEADER,
  createCampaignContentSourceClient,
  createRuntimeAssertionHeaders,
  decodeRuntimeAssertion,
  mapCampaignContentSourceFailure,
} from '~/lib/campaign-content-source-boundary';
import { toCampaignContentAssetPath } from '~/lib/campaign-content-asset-rewrite';

const sourceConfig = {
  baseUrl: 'https://woa-admin.example.invalid',
  assertionSecret: 'test-runtime-secret',
  assertionAudience: 'woa-admin:campaign-content:v1',
};

function makeSourceEntry(overrides: {
  id?: string;
  collectionKey?: string;
  collection?: string;
  campaignSlug?: string;
  data?: Record<string, unknown>;
  markdown?: string;
} = {}) {
  const campaignSlug = overrides.campaignSlug ?? 'sample-campaign';
  const collectionKey = overrides.collectionKey ?? 'pages';
  const collection = overrides.collection ?? (collectionKey === 'notes' ? 'campaignNotes' : 'campaignPages');
  const baseData = {
    campaign: campaignSlug,
    collection,
    title: 'Sample Campaign',
    type: collectionKey === 'notes' ? 'session-note' : 'campaign',
    publication: 'publish',
    visibility: 'public',
    authors: ['brad'],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-24T12:00:00Z',
    contentState: 'stable',
    audienceWarnings: [],
  };

  return {
    id: overrides.id ?? 'index',
    collectionKey,
    collection,
    campaignSlug,
    data: { ...baseData, ...overrides.data },
    ...(overrides.markdown === undefined ? {} : { markdown: overrides.markdown }),
  };
}

function assetPath(path: string) {
  const parsed = toCampaignContentAssetPath(path);
  if (!parsed) {
    throw new Error(`Invalid test asset path: ${path}`);
  }
  return parsed;
}

describe('campaign content source boundary', () => {
  it('loads and validates Campaign Surface Registry items without runtime assertion headers', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          items: [
            {
              campaignSlug: 'the-weight-of-sun-and-soil',
              title: 'The Weight of Sun and Soil',
              gate: 'campaignMembers',
              updatedAt: '2026-07-29T00:00:00Z',
            },
            {
              campaignSlug: 'public-campaign',
              title: 'Public Campaign',
              gate: 'public',
              updatedAt: '2026-07-29T00:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(client.listCampaignSurfaces()).resolves.toEqual({
      ok: true,
      value: {
        items: [
          {
            campaignSlug: 'the-weight-of-sun-and-soil',
            title: 'The Weight of Sun and Soil',
            gate: 'campaignMembers',
            updatedAt: '2026-07-29T00:00:00Z',
          },
          {
            campaignSlug: 'public-campaign',
            title: 'Public Campaign',
            gate: 'public',
            updatedAt: '2026-07-29T00:00:00Z',
          },
        ],
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://woa-admin.example.invalid/api/v1/campaigns');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'application/json' });
  });

  it.each([
    ['missing items', {}],
    ['extra response field', { items: [], total: 1 }],
    ['invalid slug', { items: [{ campaignSlug: 'Bad Slug', title: 'Bad', gate: 'public', updatedAt: '2026-07-29T00:00:00Z' }] }],
    ['whitespace-padded slug', { items: [{ campaignSlug: ' padded-slug ', title: 'Bad', gate: 'public', updatedAt: '2026-07-29T00:00:00Z' }] }],
    ['invalid gate', { items: [{ campaignSlug: 'bad-gate', title: 'Bad', gate: 'gm', updatedAt: '2026-07-29T00:00:00Z' }] }],
    ['non-date-time updatedAt', { items: [{ campaignSlug: 'bad-date', title: 'Bad', gate: 'public', updatedAt: '2026-07-29' }] }],
    ['date-time without timezone', { items: [{ campaignSlug: 'bad-date', title: 'Bad', gate: 'public', updatedAt: '2026-07-29T00:00:00' }] }],
    ['extra item field', { items: [{ campaignSlug: 'extra-field', title: 'Bad', gate: 'public', updatedAt: '2026-07-29T00:00:00Z', bucket: 'private' }] }],
  ] as const)('fails closed when Campaign Surface Registry response has %s', async (_label, body) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(client.listCampaignSurfaces()).resolves.toMatchObject({ ok: false, reason: 'validationFailure', mainSiteStatus: 503 });
  });

  it('fails closed when the Campaign Surface Registry source is unavailable', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'service_unavailable', message: 'down' } }), { status: 503 }));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(client.listCampaignSurfaces()).resolves.toMatchObject({ ok: false, reason: 'sourceUnavailable', mainSiteStatus: 503 });
  });

  it('mints campaign-scoped read assertions with a 60-second expiry and non-PII subject', async () => {
    const issuedAt = new Date('2026-07-24T12:00:00.000Z');

    const headers = await createRuntimeAssertionHeaders({
      config: sourceConfig,
      campaignSlug: 'brad',
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user_123456789', traceId: 'member-session-1' },
      issuedAt,
    });

    const payload = decodeRuntimeAssertion(headers[RUNTIME_ASSERTION_HEADER]);

    expect(payload).toMatchObject({
      aud: 'woa-admin:campaign-content:v1',
      campaignSlug: 'brad',
      operation: 'content:read',
      allowedVisibility: ['public', 'campaignMembers'],
    });
    expect(payload.exp).toBe(Math.floor(issuedAt.getTime() / 1000) + ASSERTION_EXPIRY_SECONDS);
    expect(payload.subject).toMatch(/^auth_[A-Za-z0-9_-]{24}$/);
    expect(payload).not.toHaveProperty('iat');
    expect(JSON.stringify(payload)).not.toContain('user_123456789');
    expect(JSON.stringify(payload)).not.toContain('member-session-1');
    expect(headers[RUNTIME_ASSERTION_SIGNATURE_HEADER]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('always attaches assertion headers, including anonymous public-only reads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          items: [makeSourceEntry()],
          nextCursor: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.listCampaignContent({
      campaignSlug: 'sample-campaign',
      collectionKey: 'pages',
      allowedVisibilities: ['public'],
      actor: { kind: 'anonymous' },
      type: 'overview',
      subtype: 'root',
      tag: 'intro',
      author: 'author-1',
      contributor: 'contributor-1',
      title: 'sample',
      updatedSince: '2026-07-01T00:00:00Z',
      limit: 25,
      cursor: 'next page',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://woa-admin.example.invalid/api/v1/campaigns/sample-campaign/collections/pages/documents?type=overview&subtype=root&tag=intro&author=author-1&contributor=contributor-1&title=sample&updatedSince=2026-07-01T00%3A00%3A00Z&limit=25&cursor=next+page',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: 'application/json',
      [RUNTIME_ASSERTION_HEADER]: expect.any(String),
      [RUNTIME_ASSERTION_SIGNATURE_HEADER]: expect.any(String),
    });
  });

  it('maps detail reads with structured campaign, collection, and document identifiers', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify(makeSourceEntry({
          id: 'session-zero',
          collectionKey: 'notes',
          collection: 'campaignNotes',
          campaignSlug: 'brad',
          data: { campaign: 'brad', collection: 'campaignNotes', title: 'Session Zero', visibility: 'campaignMembers' },
          markdown: '# Session Zero',
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentItem({
      campaignSlug: 'brad',
      collectionKey: 'notes',
      documentId: 'session-zero',
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        campaignSlug: 'brad',
        collectionKey: 'notes',
        documentId: 'session-zero',
        title: 'Session Zero',
        visibility: 'campaignMembers',
        body: '# Session Zero',
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://woa-admin.example.invalid/api/v1/campaigns/brad/collections/notes/documents/session-zero',
    );
  });

  it('fails closed when source responses are malformed or broader than the asserted visibility scope', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          items: [
            makeSourceEntry({
              id: 'gm-secret',
              collectionKey: 'notes',
              collection: 'campaignNotes',
              campaignSlug: 'brad',
              data: { campaign: 'brad', collection: 'campaignNotes', title: 'GM Secret', type: 'gm-note', visibility: 'gm' },
            }),
          ],
          nextCursor: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(
      client.listCampaignContent({
        campaignSlug: 'brad',
        collectionKey: 'notes',
        allowedVisibilities: ['public', 'campaignMembers'],
        actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'validationFailure',
      mainSiteStatus: 503,
      retryable: false,
      safeMessage: 'Campaign content unavailable.',
    });
  });

  it.each([
    ['missing collectionKey', { omit: 'collectionKey' }],
    ['mismatched collection mapping', { collection: 'campaignPages' }],
    ['mismatched data collection', { data: { collection: 'campaignPages' } }],
    ['unpublished content', { data: { publication: 'preview' } }],
    ['missing title', { data: { title: '' } }],
    ['missing type', { data: { type: '' } }],
    ['missing authors', { data: { authors: [] } }],
    ['missing createdAt', { data: { createdAt: '' } }],
    ['missing updatedAt', { data: { updatedAt: '' } }],
  ] as const)('fails closed when source list responses have %s', async (_label, entryOverrides) => {
    const entry = makeSourceEntry({ collectionKey: 'notes', collection: 'campaignNotes', campaignSlug: 'brad', ...entryOverrides });
    if ('omit' in entryOverrides && entryOverrides.omit === 'collectionKey') {
      delete (entry as { collectionKey?: string }).collectionKey;
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [entry], nextCursor: null }), { status: 200 }));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(
      client.listCampaignContent({
        campaignSlug: 'brad',
        collectionKey: 'notes',
        allowedVisibilities: ['public', 'campaignMembers'],
        actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'validationFailure', mainSiteStatus: 503 });
  });

  it('fails closed when source detail responses omit Markdown', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(makeSourceEntry({ id: 'session-zero', collectionKey: 'notes', collection: 'campaignNotes', campaignSlug: 'brad' })), {
        status: 200,
      }),
    );
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(
      client.getCampaignContentItem({
        campaignSlug: 'brad',
        collectionKey: 'notes',
        documentId: 'session-zero',
        allowedVisibilities: ['public', 'campaignMembers'],
        actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'validationFailure', mainSiteStatus: 503 });
  });

  it.each([
    [404, 'notFoundOrNotReadable', 404, false],
    [401, 'integrationRejected', 503, false],
    [400, 'invalidRequest', 503, false],
    [429, 'rateLimited', 503, true],
    [503, 'sourceUnavailable', 503, true],
  ] as const)('maps source status %s to safe main-site failure behavior', (status, reason, mainSiteStatus, retryable) => {
    expect(mapCampaignContentSourceFailure({ status })).toMatchObject({
      ok: false,
      reason,
      mainSiteStatus,
      retryable,
    });
  });

  it('maps network failures to fail-closed unavailable results', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError('connection refused');
    });
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    await expect(
      client.getCampaignContentItem({
        campaignSlug: 'brad',
        collectionKey: 'notes',
        documentId: 'session-zero',
        allowedVisibilities: ['public'],
        actor: { kind: 'anonymous' },
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'networkFailure',
      mainSiteStatus: 503,
      retryable: true,
      safeMessage: 'Campaign content unavailable.',
    });
  });
});

describe('campaign content asset source reads', () => {
  function assetBytes(bytes: number[]): Response {
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { 'content-type': 'image/png', etag: '"asset-etag"' },
    });
  }

  it('builds the asset endpoint URL with a path query and signs assertions', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => assetBytes([1, 2, 3]));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentAsset({
      campaignSlug: 'brad',
      assetPath: assetPath('assets/hero.png'),
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://woa-admin.example.invalid/api/v1/campaigns/brad/assets?path=assets%2Fhero.png',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      [RUNTIME_ASSERTION_HEADER]: expect.any(String),
      [RUNTIME_ASSERTION_SIGNATURE_HEADER]: expect.any(String),
    });
    expect(result).toMatchObject({
      ok: true,
      value: { contentType: 'image/png', etag: '"asset-etag"' },
    });
    if (result.ok) {
      expect(new Uint8Array(await new Response(result.value.body).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    }
  });

  it('passes an abort signal to asset source reads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return assetBytes([1]);
    });
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentAsset({
      campaignSlug: 'brad',
      assetPath: assetPath('assets/hero.png'),
      allowedVisibilities: ['public'],
      actor: { kind: 'anonymous' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      await new Response(result.value.body).arrayBuffer();
    }
    expect(CAMPAIGN_CONTENT_ASSET_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('maps a missing or unreadable asset to a generic 404', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('not found', { status: 404 }));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentAsset({
      campaignSlug: 'brad',
      assetPath: assetPath('assets/missing.png'),
      allowedVisibilities: ['public'],
      actor: { kind: 'anonymous' },
    });

    expect(result).toMatchObject({ ok: false, reason: 'notFoundOrNotReadable', mainSiteStatus: 404 });
  });

  it('maps source errors to fail-closed unavailable behavior', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('unavailable', { status: 503 }));
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentAsset({
      campaignSlug: 'brad',
      assetPath: assetPath('assets/hero.png'),
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user_123', traceId: 'session_123' },
    });

    expect(result).toMatchObject({ ok: false, reason: 'sourceUnavailable', mainSiteStatus: 503 });
  });

  it('maps network failures to fail-closed unavailable behavior', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('connection refused');
    });
    const client = createCampaignContentSourceClient({ config: sourceConfig, fetch: fetchMock });

    const result = await client.getCampaignContentAsset({
      campaignSlug: 'brad',
      assetPath: assetPath('assets/hero.png'),
      allowedVisibilities: ['public'],
      actor: { kind: 'anonymous' },
    });

    expect(result).toMatchObject({ ok: false, reason: 'networkFailure', mainSiteStatus: 503 });
  });
});
