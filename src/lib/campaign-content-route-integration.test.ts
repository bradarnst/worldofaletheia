// src/lib/campaign-content-route-integration.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCampaignContentLiveLoader } from '~/lib/campaign-content-live-loader';
import {
  RUNTIME_ASSERTION_HEADER,
  RUNTIME_ASSERTION_SIGNATURE_HEADER,
  createCampaignContentSourceClient,
} from '~/lib/campaign-content-source-boundary';
import { buildCampaignContentPageModel, type CampaignContentPageLiveEntryGetter } from '~/lib/campaign-content-page';
import { buildCampaignIndexModel } from '~/lib/campaign-index';
import { buildCampaignNotesListModel, type CampaignNotesListLiveGetter, type CampaignNotesPageEntry } from '~/lib/campaign-notes';
import { parseCampaignGateManifest, type CampaignAccessRole } from '~/lib/campaign-gate-policy';

const sourceBaseUrl = 'https://woa-admin.example.invalid';
const gateManifest = parseCampaignGateManifest({ public: 'public', members: 'campaignMembers' });

type Viewer = { kind: 'anonymous' } | { kind: 'authenticated'; userId: string; traceId: string };

interface SourceCall {
  url: string;
  assertion: string;
  signature: string;
  allowedVisibility: string[];
}

function sourceEntry(input: {
  campaignSlug: string;
  collectionKey: 'pages' | 'notes';
  id: string;
  title: string;
  visibility: 'public' | 'campaignMembers' | 'gm';
  markdown?: string;
  type?: string;
}) {
  const collection = input.collectionKey === 'pages' ? 'campaignPages' : 'campaignNotes';
  return {
    id: input.id,
    collectionKey: input.collectionKey,
    collection,
    campaignSlug: input.campaignSlug,
    data: {
      campaign: input.campaignSlug,
      collection,
      title: input.title,
      type: input.type ?? (input.collectionKey === 'pages' ? 'campaign' : 'campaign-note'),
      publication: 'publish',
      visibility: input.visibility,
      authors: ['brad'],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-24T12:00:00Z',
      contentState: 'stable',
      audienceWarnings: [],
      tags: [],
    },
    ...(input.markdown === undefined ? {} : { markdown: input.markdown }),
  };
}

function decodeAssertion(assertion: string): { allowedVisibility: string[] } {
  const base64 = assertion.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const decoded = JSON.parse(atob(padded)) as { allowedVisibility?: unknown };
  return { allowedVisibility: Array.isArray(decoded.allowedVisibility) ? decoded.allowedVisibility.filter((item): item is string => typeof item === 'string') : [] };
}

function makeRouteHarness() {
  const calls: SourceCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const assertion = headers.get(RUNTIME_ASSERTION_HEADER) ?? '';
    const signature = headers.get(RUNTIME_ASSERTION_SIGNATURE_HEADER) ?? '';
    calls.push({ url: url.toString(), assertion, signature, allowedVisibility: decodeAssertion(assertion).allowedVisibility });

    if (url.pathname.endsWith('/assets')) {
      return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200, headers: { 'content-type': 'image/png' } });
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const campaignSlug = pathParts[3] ?? '';
    const collectionKey = pathParts[5] as 'pages' | 'notes' | undefined;
    const documentId = pathParts[7];

    if (documentId) {
      const visibility = documentId === 'gm-only' ? 'gm' : collectionKey === 'notes' && campaignSlug === 'members' ? 'campaignMembers' : 'public';
      if (!decodeAssertion(assertion).allowedVisibility.includes(visibility)) {
        return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Campaign content was not found.' } }), { status: 404 });
      }
      return new Response(
        JSON.stringify(
          sourceEntry({
            campaignSlug,
            collectionKey: collectionKey ?? 'pages',
            id: documentId,
            title: documentId === 'index' ? `${campaignSlug} Campaign` : documentId === 'about' ? 'About the Campaign' : documentId === 'gm-only' ? 'GM Secrets' : 'Campaign Root',
            visibility,
            markdown:
              documentId === 'gm-only'
                ? '# GM Secrets\n\nOnly the GM can see this.'
                : '# Campaign Root\n\n![Map](https://woa-admin.example.invalid/api/v1/campaigns/public/assets?path=assets/map.png)',
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const items = collectionKey === 'notes'
      ? [
          sourceEntry({ campaignSlug, collectionKey: 'notes', id: 'public-note', title: 'Public Note', visibility: 'public' }),
          ...(decodeAssertion(assertion).allowedVisibility.includes('campaignMembers')
            ? [sourceEntry({ campaignSlug, collectionKey: 'notes', id: 'member-note', title: 'Member Note', visibility: 'campaignMembers' })]
            : []),
          ...(decodeAssertion(assertion).allowedVisibility.includes('gm')
            ? [sourceEntry({ campaignSlug, collectionKey: 'notes', id: 'gm-only', title: 'GM Secrets', visibility: 'gm' })]
            : []),
        ]
      : [sourceEntry({ campaignSlug, collectionKey: 'pages', id: 'index', title: `${campaignSlug} Campaign`, visibility: 'public' })];

    return new Response(JSON.stringify({ items, nextCursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const sourceClient = createCampaignContentSourceClient({
    config: { baseUrl: sourceBaseUrl, assertionSecret: 'test-secret', assertionAudience: 'woa-admin:campaign-content:v1' },
    fetch: fetchMock,
  });
  const loader = createCampaignContentLiveLoader({ sourceClient, sourceBaseUrl });

  const getLiveEntry: CampaignContentPageLiveEntryGetter = async (collection, filter) => {
    const result = await loader.loadEntry({ collection, filter });
    if (!result) {
      return {};
    }
    if ('error' in result) {
      return { error: result.error };
    }
    return { entry: result };
  };

  const getLiveCollection: CampaignNotesListLiveGetter = async (collection, filter) => {
    const result = await loader.loadCollection({ collection, filter });
    if ('error' in result) {
      return { error: result.error };
    }
    return { entries: result.entries as CampaignNotesPageEntry[] };
  };

  return { calls, getLiveEntry, getLiveCollection };
}

function renderBrowserResponse(input: { status: number; robots: string | null; html: string }): Response {
  const robots = input.robots ? `<meta name="robots" content="${input.robots}">` : '';
  return new Response(`<!doctype html><html><head>${robots}</head><body>${input.html}</body></html>`, { status: input.status });
}

function assertNoSentinelRuntimeAssertionLeak(responseText: string, calls: SourceCall[]): void {
  for (const call of calls) {
    // Each outgoing source call gives us sentinel assertion/signature values to
    // prove the final browser response does not echo server-to-server secrets.
    expect(responseText).not.toContain(call.assertion);
    expect(responseText).not.toContain(call.signature);
  }
  expect(responseText).not.toContain(RUNTIME_ASSERTION_HEADER);
  expect(responseText).not.toContain(RUNTIME_ASSERTION_SIGNATURE_HEADER);
  expect(responseText).not.toContain('woa-admin:campaign-content:v1');
  expect(responseText).not.toContain('allowedVisibility');
}

describe('Campaign Content browser-facing route integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies Campaign Index final HTML with public-only source scope', async () => {
    const harness = makeRouteHarness();
    const model = await buildCampaignIndexModel({
      campaigns: [
        { campaignSlug: 'public', title: 'public Campaign', gate: 'public' },
        { campaignSlug: 'members', title: 'members Campaign', gate: 'campaignMembers' },
      ],
      viewer: { kind: 'anonymous' },
      loadCampaignSurfaces: vi.fn(async () => []),
    });
    const response = renderBrowserResponse({ status: 200, robots: null, html: model.campaigns.map((campaign) => campaign.title).join('\n') });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('public Campaign');
    expect(html).toContain('members Campaign');
    expect(html).not.toContain('GM Secrets');
    expect(harness.calls).toEqual([]);
    assertNoSentinelRuntimeAssertionLeak(html, harness.calls);
  });

  it.each([
    ['public root for anonymous', 'public', { kind: 'anonymous' } satisfies Viewer, 'anonymous' as CampaignAccessRole, 'index', 200, null, ['public']],
    ['member-gated root blocks anonymous before source', 'members', { kind: 'anonymous' } satisfies Viewer, 'anonymous' as CampaignAccessRole, 'index', 404, 'noindex, nofollow', []],
    [
      'member-gated about for member',
      'members',
      { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' } satisfies Viewer,
      'member' as CampaignAccessRole,
      'about',
      200,
      'noindex, nofollow',
      ['public', 'campaignMembers'],
    ],
    [
      'GM-only note detail for GM',
      'members',
      { kind: 'authenticated', userId: 'gm-1', traceId: 'trace-2' } satisfies Viewer,
      'gm' as CampaignAccessRole,
      'gm-only',
      200,
      'noindex, nofollow',
      ['public', 'campaignMembers', 'gm'],
    ],
  ])('verifies %s route status, robots, HTML, and source calls', async (_label, campaignSlug, viewer, role, documentId, status, robots, expectedScope) => {
    const harness = makeRouteHarness();
    const model = await buildCampaignContentPageModel({
      campaignSlug,
      documentId,
      collectionKey: documentId === 'gm-only' ? 'notes' : 'pages',
      viewer,
      gateManifest,
      getCampaignAccessRole: async () => role,
      getLiveEntry: harness.getLiveEntry,
    });
    const response = renderBrowserResponse({ status: model.httpStatus, robots: model.robots, html: model.entry?.rendered?.html ?? 'not found' });
    const html = await response.text();

    expect(response.status).toBe(status);
    expect(html).toContain(robots ? `content="${robots}"` : '<head></head>');
    expect(harness.calls[0]?.allowedVisibility ?? []).toEqual(expectedScope);
    if (expectedScope.length === 0) {
      expect(harness.calls).toHaveLength(0);
    }
    if (status === 200) {
      expect(html).toContain(documentId === 'gm-only' ? 'GM Secrets' : 'Campaign Root');
      expect(html).not.toContain('woa-admin.example.invalid');
    }
    assertNoSentinelRuntimeAssertionLeak(html, harness.calls);
  });

  it('verifies notes list member and GM visibility scopes through rendered HTML', async () => {
    const memberHarness = makeRouteHarness();
    const memberModel = await buildCampaignNotesListModel({
      campaignSlug: 'members',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      gateManifest,
      getCampaignAccessRole: async () => 'member',
      getLiveCollection: memberHarness.getLiveCollection,
    });
    const memberResponse = renderBrowserResponse({
      status: memberModel.httpStatus,
      robots: memberModel.robots,
      html: memberModel.entries.map((entry) => entry.title).join('\n'),
    });
    const memberHtml = await memberResponse.text();

    expect(memberResponse.status).toBe(200);
    expect(memberHtml).toContain('Member Note');
    expect(memberHtml).not.toContain('GM Secrets');
    expect(memberHarness.calls[0]?.allowedVisibility).toEqual(['public', 'campaignMembers']);
    assertNoSentinelRuntimeAssertionLeak(memberHtml, memberHarness.calls);

    const gmHarness = makeRouteHarness();
    const gmModel = await buildCampaignNotesListModel({
      campaignSlug: 'members',
      viewer: { kind: 'authenticated', userId: 'gm-1', traceId: 'trace-2' },
      gateManifest,
      getCampaignAccessRole: async () => 'gm',
      getLiveCollection: gmHarness.getLiveCollection,
    });
    const gmResponse = renderBrowserResponse({ status: gmModel.httpStatus, robots: gmModel.robots, html: gmModel.entries.map((entry) => entry.title).join('\n') });
    const gmHtml = await gmResponse.text();

    expect(gmResponse.status).toBe(200);
    expect(gmHtml).toContain('GM Secrets');
    expect(gmHarness.calls[0]?.allowedVisibility).toEqual(['public', 'campaignMembers', 'gm']);
    assertNoSentinelRuntimeAssertionLeak(gmHtml, gmHarness.calls);
  });
});
