// src/lib/campaign-content-page.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignContentPageModel,
  type CampaignContentPageEntry,
  type CampaignContentPageLiveEntryGetter,
} from '~/lib/campaign-content-page';
import { parseCampaignGateManifest } from '~/lib/campaign-gate-policy';
import type { CampaignAccessRole } from '~/lib/campaign-gate-policy';

function makeEntry(overrides: Partial<CampaignContentPageEntry['data']> = {}): CampaignContentPageEntry {
  return {
    id: 'sample-campaign/pages/index',
    data: {
      collection: 'campaignContent',
      campaign: 'sample-campaign',
      campaignSlug: 'sample-campaign',
      collectionKey: 'pages',
      documentId: 'index',
      title: 'Sample Campaign',
      visibility: 'public',
      updatedAt: null,
      type: 'page',
      tags: [],
      authors: ['brad'],
      contributors: [],
      ...overrides,
    },
    rendered: { html: '<p>Sample root content.</p>' },
  };
}

function liveEntryResult(entry: CampaignContentPageEntry) {
  return Promise.resolve({ entry });
}

function liveEntryNotFoundError() {
  const error = new Error('Live entry not found');
  error.name = 'LiveEntryNotFoundError';
  return Promise.resolve({ error });
}

function liveEntryUnknownError() {
  const error = new Error('source exploded');
  error.name = 'LiveCollectionError';
  return Promise.resolve({ error });
}

describe('buildCampaignContentPageModel (issue #9)', () => {
  it('renders a public campaign root for anonymous viewers and is indexable', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryResult(makeEntry({ visibility: 'public' })));
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(getLiveEntry).toHaveBeenCalledTimes(1);
    expect(model.gate).toBe('public');
    expect(model.gateAllowsRequest).toBe(true);
    expect(model.sourceFetched).toBe(true);
    expect(model.isAvailable).toBe(true);
    expect(model.canView).toBe(true);
    expect(model.visibility).toBe('public');
    expect(model.robots).toBeNull();
    expect(model.httpStatus).toBe(200);
    expect(model.reason).toBe('ok');
  });

  it('blocks anonymous users from a campaignMembers-gated root BEFORE any source fetch', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ campaignSlug: 'brad', documentId: 'index', visibility: 'public' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(model.gate).toBe('campaignMembers');
    expect(model.gateAllowsRequest).toBe(false);
    expect(model.sourceFetched).toBe(false);
    expect(model.canView).toBe(false);
    expect(model.entry).toBeNull();
    expect(model.robots).toBe('noindex, nofollow');
    expect(getLiveEntry).not.toHaveBeenCalled();
  });

  it('allows a campaign member to read a campaignMembers-gated root', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ campaignSlug: 'brad', documentId: 'index', visibility: 'campaignMembers' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'index',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'member',
  getLiveEntry,
});

    expect(model.gateAllowsRequest).toBe(true);
    expect(model.canView).toBe(true);
    expect(model.visibility).toBe('campaignMembers');
    expect(model.robots).toBe('noindex, nofollow');
    const [collection, filter] = getLiveEntry.mock.calls[0] as [string, Record<string, unknown>];
    expect(collection).toBe('campaignContent');
    expect(filter.accessScope).toEqual({
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
    });
  });

  it('allows a GM to read a gm-visibility root item', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ campaignSlug: 'brad', documentId: 'index', visibility: 'gm' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'index',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'gm' as CampaignAccessRole,
  getLiveEntry,
});

    expect(model.canView).toBe(true);
    expect(model.visibility).toBe('gm');
    const [, filter] = getLiveEntry.mock.calls[0] as [string, Record<string, unknown>];
    expect((filter.accessScope as { allowedVisibilities: string[] }).allowedVisibilities).toEqual([
      'public',
      'campaignMembers',
      'gm',
    ]);
  });

  it('treats a missing source item as not found (404, noindex) for a passed gate', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryNotFoundError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(model.isAvailable).toBe(false);
    expect(model.canView).toBe(false);
    expect(model.httpStatus).toBe(404);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('not_found');
  });

  it('treats an unavailable source as 503 (noindex)', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryUnknownError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(model.canView).toBe(false);
    expect(model.httpStatus).toBe(503);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('unavailable');
  });

  it('falls back to campaignMembers for a campaign missing from the manifest, blocking anonymous', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryResult(makeEntry({ campaignSlug: 'ghost', documentId: 'index' })));
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'ghost',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry: getLiveEntry as unknown as CampaignContentPageLiveEntryGetter,
      gateManifest: parseCampaignGateManifest({}),
    });

    expect(model.gate).toBe('campaignMembers');
    expect(model.gateSource).toBe('missing-default');
    expect(model.gateAllowsRequest).toBe(false);
    expect(getLiveEntry).not.toHaveBeenCalled();
  });

  it('constrains the about page by Content Visibility after a public gate passes', async () => {
    // Public gate allows anonymous, but the about item is campaignMembers-only, so the
    // source will not return it (allowedVisibilities = ['public']).
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryNotFoundError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'about',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(model.gateAllowsRequest).toBe(true);
    expect(model.sourceFetched).toBe(true);
    // Visibility constraint is enforced by the source: anonymous readers never receive it.
    expect(model.canView).toBe(false);
    expect(model.reason).toBe('not_found');
  });

  it('renders a public about page for anonymous viewers and is indexable', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ documentId: 'about', title: 'About Sample', visibility: 'public' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'about',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
  getLiveEntry,
});

    expect(model.canView).toBe(true);
    expect(model.visibility).toBe('public');
    expect(model.robots).toBeNull();
    expect(model.reason).toBe('ok');
  });
});
