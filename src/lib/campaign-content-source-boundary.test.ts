import { describe, expect, it, vi } from 'vitest';
import {
  ASSERTION_EXPIRY_SECONDS,
  RUNTIME_ASSERTION_HEADER,
  RUNTIME_ASSERTION_SIGNATURE_HEADER,
  createCampaignContentSourceClient,
  createRuntimeAssertionHeaders,
  decodeRuntimeAssertion,
  mapCampaignContentSourceFailure,
} from '~/lib/campaign-content-source-boundary';

const sourceConfig = {
  baseUrl: 'https://woa-admin.example.invalid',
  assertionSecret: 'test-runtime-secret',
  assertionAudience: 'woa-admin:campaign-content-source:v1',
};

describe('campaign content source boundary', () => {
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
      aud: 'woa-admin:campaign-content-source:v1',
      campaignSlug: 'brad',
      operation: 'campaignContent:read',
      allowedVisibilities: ['public', 'campaignMembers'],
      subject: { kind: 'authenticated' },
    });
    expect(payload.exp - payload.iat).toBe(ASSERTION_EXPIRY_SECONDS);
    expect(payload.exp).toBe(Math.floor(issuedAt.getTime() / 1000) + 60);
    expect(JSON.stringify(payload)).not.toContain('user_123456789');
    expect(JSON.stringify(payload)).not.toContain('member-session-1');
    expect(headers[RUNTIME_ASSERTION_SIGNATURE_HEADER]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('always attaches assertion headers, including anonymous public-only reads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          campaignSlug: 'sample-campaign',
          items: [
            {
              collectionKey: 'pages',
              documentId: 'index',
              title: 'Sample Campaign',
              visibility: 'public',
              updatedAt: '2026-07-24T12:00:00Z',
            },
          ],
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
      tag: ['intro', 'session zero'],
      author: 'author-1',
      contributor: ['contributor-1', 'contributor-2'],
      title: 'sample',
      updatedSince: '2026-07-01T00:00:00Z',
      limit: 25,
      cursor: 'next page',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://woa-admin.example.invalid/api/v1/campaigns/sample-campaign/campaign-content?collectionKey=pages&type=overview&subtype=root&tag=intro&tag=session+zero&author=author-1&contributor=contributor-1&contributor=contributor-2&title=sample&updatedSince=2026-07-01T00%3A00%3A00Z&limit=25&cursor=next+page',
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
        JSON.stringify({
          campaignSlug: 'brad',
          item: {
            collectionKey: 'notes',
            documentId: 'session-zero',
            title: 'Session Zero',
            visibility: 'campaignMembers',
            body: '# Session Zero',
            updatedAt: '2026-07-24T12:00:00Z',
          },
        }),
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
      'https://woa-admin.example.invalid/api/v1/campaigns/brad/campaign-content/notes/session-zero',
    );
  });

  it('fails closed when source responses are malformed or broader than the asserted visibility scope', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          campaignSlug: 'brad',
          items: [
            {
              collectionKey: 'notes',
              documentId: 'gm-secret',
              title: 'GM Secret',
              visibility: 'gm',
            },
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
