// src/lib/campaign-content-page.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignContentPageModel as buildCampaignContentPageModelImpl,
  type CampaignContentPageEntry,
  type CampaignContentPageLiveEntryGetter,
} from '~/lib/campaign-content-page';
import { parseCampaignGateManifest } from '~/lib/campaign-gate-policy';
import type { CampaignAccessRole } from '~/lib/campaign-gate-policy';

const testGateManifest = parseCampaignGateManifest({
  'sample-campaign': 'public',
  brad: 'campaignMembers',
});

function buildCampaignContentPageModel(
  input: Parameters<typeof buildCampaignContentPageModelImpl>[0],
) {
  return buildCampaignContentPageModelImpl({ ...input, gateManifest: testGateManifest });
}

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
    expect(model.httpStatus).toBe(404);
    expect(model.reason).toBe('not_found');
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

  it('treats Astro live entry results without an entry as not found', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => ({}));
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry,
    });

    expect(model.httpStatus).toBe(404);
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

  it('treats a thrown source failure as source_error (503, noindex)', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(() =>
      Promise.reject(new Error('source exploded')),
    );
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
    expect(model.reason).toBe('source_error');
  });

  it('falls back to campaignMembers for a campaign missing from the manifest, blocking anonymous', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryResult(makeEntry({ campaignSlug: 'ghost', documentId: 'index' })));
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'ghost',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry,
      gateManifest: parseCampaignGateManifest({}),
    });

    expect(model.gate).toBe('campaignMembers');
    expect(model.gateSource).toBe('missing-default');
    expect(model.gateAllowsRequest).toBe(false);
    expect(model.httpStatus).toBe(404);
    expect(model.reason).toBe('not_found');
    expect(getLiveEntry).not.toHaveBeenCalled();
  });

  it('warns but still reads source-available content for a member when the manifest entry is missing', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ campaignSlug: 'ghost', documentId: 'about', visibility: 'campaignMembers' })),
    );

    const model = await buildCampaignContentPageModel({
      campaignSlug: 'ghost',
      documentId: 'about',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'member',
      getLiveEntry,
      gateManifest: parseCampaignGateManifest({}),
      logger,
    });

    expect(model).toMatchObject({
      gate: 'campaignMembers',
      gateSource: 'missing-default',
      sourceFetched: true,
      canView: true,
      robots: 'noindex, nofollow',
    });
    expect(logger.warn).toHaveBeenCalledWith('campaign.gate_manifest.missing_entry', expect.objectContaining({ campaignSlug: 'ghost' }));
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

  it('treats a visibility mismatch as not found (404, noindex)', async () => {
    // Defensive: the source should never return an entry outside allowedVisibilities, but the
    // model must still treat it as a visibility_mismatch if it does.
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeEntry({ visibility: 'campaignMembers' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'sample-campaign',
      documentId: 'index',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry,
    });

    expect(model.canView).toBe(false);
    expect(model.httpStatus).toBe(404);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('visibility_mismatch');
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
