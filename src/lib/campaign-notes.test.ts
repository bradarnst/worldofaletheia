// src/lib/campaign-notes.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignNotesListModel,
  type CampaignNotesListLiveGetter,
  type CampaignNotesPageEntry,
} from '~/lib/campaign-notes';
import {
  buildCampaignContentPageModel,
  type CampaignContentPageEntry,
  type CampaignContentPageLiveEntryGetter,
} from '~/lib/campaign-content-page';
import { parseCampaignGateManifest, type CampaignAccessRole } from '~/lib/campaign-gate-policy';

const publicGateManifest = parseCampaignGateManifest({ 'public-fixture': 'public' });

// --- Helpers: notes list entries ---------------------------------------------------------

function makeNoteEntry(overrides: Partial<CampaignNotesPageEntry['data']> = {}): CampaignNotesPageEntry {
  const campaignSlug = overrides.campaignSlug ?? 'public-fixture';
  const documentId = overrides.documentId ?? 'session-zero';
  return {
    id: `${campaignSlug}/notes/${documentId}`,
    data: {
      collection: 'campaignContent',
      campaign: campaignSlug,
      campaignSlug,
      collectionKey: 'notes',
      documentId,
      title: overrides.title ?? 'Session Zero',
      visibility: overrides.visibility ?? 'public',
      updatedAt: overrides.updatedAt ?? null,
      type: overrides.type ?? 'note',
      excerpt: overrides.excerpt,
      tags: overrides.tags ?? [],
      authors: overrides.authors ?? ['brad'],
      contributors: overrides.contributors ?? [],
    },
    rendered: { html: '<p>Note body.</p>' },
  };
}

function liveNotes(entries: CampaignNotesPageEntry[]) {
  return Promise.resolve({ entries });
}

function liveNotesError() {
  const error = new Error('Live collection error');
  error.name = 'LiveCollectionError';
  return Promise.resolve({ error });
}

// --- Helpers: note detail entries (reuses the page model) -------------------------------

function makeNotePageEntry(overrides: Partial<CampaignContentPageEntry['data']> = {}): CampaignContentPageEntry {
  const campaignSlug = overrides.campaignSlug ?? 'brad';
  const documentId = overrides.documentId ?? 'session-zero';
  return {
    id: `${campaignSlug}/notes/${documentId}`,
    data: {
      collection: 'campaignContent',
      campaign: campaignSlug,
      campaignSlug,
      collectionKey: 'notes',
      documentId,
      title: overrides.title ?? 'Session Zero',
      visibility: overrides.visibility ?? 'gm',
      updatedAt: overrides.updatedAt ?? null,
      type: overrides.type ?? 'note',
      excerpt: overrides.excerpt,
      tags: overrides.tags ?? [],
      authors: overrides.authors ?? ['brad'],
      contributors: overrides.contributors ?? [],
    },
    rendered: { html: '<p>Note body.</p>' },
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

// === Notes list (issue #10) =============================================================

describe('buildCampaignNotesListModel (issue #10)', () => {
  it('lists public notes for anonymous viewers on a public gate and is indexable', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async () =>
      liveNotes([makeNoteEntry({ visibility: 'public', title: 'Welcome Note' })]),
    );
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveCollection,
    });

    expect(getLiveCollection).toHaveBeenCalledTimes(1);
    expect(model.gate).toBe('public');
    expect(model.gateAllowsRequest).toBe(true);
    expect(model.sourceFetched).toBe(true);
    expect(model.isAvailable).toBe(true);
    expect(model.reason).toBe('ok');
    expect(model.robots).toBeNull();
    expect(model.httpStatus).toBe(200);
    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]?.title).toBe('Welcome Note');
    expect(model.entries[0]?.href).toBe('/campaigns/public-fixture/notes/session-zero');
  });

  it('blocks anonymous users from a campaignMembers-gated notes list BEFORE any source fetch', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async () =>
      liveNotes([makeNoteEntry({ campaignSlug: 'brad', visibility: 'campaignMembers' })]),
    );
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'brad',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveCollection,
    });

    expect(model.gate).toBe('campaignMembers');
    expect(model.gateAllowsRequest).toBe(false);
    expect(model.sourceFetched).toBe(false);
    expect(model.entries).toHaveLength(0);
    expect(model.httpStatus).toBe(200);
    expect(model.robots).toBe('noindex, nofollow');
    expect(getLiveCollection).not.toHaveBeenCalled();
  });

  it('lets a campaign member read campaignMembers notes but not GM-only notes in the list', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async (_collection, filter) => {
      const accessScope = filter.accessScope;
      expect(accessScope.allowedVisibilities).toEqual(['public', 'campaignMembers']);
      // Source enforcement: a member may not receive a gm-visibility note.
      return liveNotes([makeNoteEntry({ campaignSlug: 'brad', documentId: 'session-two', visibility: 'campaignMembers' })]);
    });
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'brad',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'member',
      getLiveCollection,
    });

    expect(model.gateAllowsRequest).toBe(true);
    expect(model.sourceFetched).toBe(true);
    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]?.visibility).toBe('campaignMembers');
    expect(model.entries[0]?.documentId).toBe('session-two');
  });

  it('lets a GM read GM-only notes in the list', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async (_collection, filter) => {
      const accessScope = filter.accessScope;
      expect(accessScope.allowedVisibilities).toEqual(['public', 'campaignMembers', 'gm']);
      return liveNotes([
        makeNoteEntry({ campaignSlug: 'brad', documentId: 'a', visibility: 'public' }),
        makeNoteEntry({ campaignSlug: 'brad', documentId: 'b', visibility: 'campaignMembers' }),
        makeNoteEntry({ campaignSlug: 'brad', documentId: 'c', visibility: 'gm' }),
      ]);
    });
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'brad',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'gm' as CampaignAccessRole,
      getLiveCollection,
    });

    expect(model.sourceFetched).toBe(true);
    expect(model.entries).toHaveLength(3);
    expect(model.entries.map((entry) => entry.visibility)).toEqual(['public', 'campaignMembers', 'gm']);
  });

  it('renders an empty list (ok) when the source returns no readable notes', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async () => liveNotes([]));
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveCollection,
    });

    expect(model.isAvailable).toBe(true);
    expect(model.reason).toBe('ok');
    expect(model.entries).toHaveLength(0);
    expect(model.httpStatus).toBe(200);
  });

  it('treats a thrown source failure as source_error (503, noindex)', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(() => Promise.reject(new Error('source exploded')));
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveCollection,
    });

    expect(model.isAvailable).toBe(false);
    expect(model.sourceFetched).toBe(true);
    expect(model.httpStatus).toBe(503);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('source_error');
  });

  it('treats an unavailable source as 503 (noindex)', async () => {
    const getLiveCollection = vi.fn<CampaignNotesListLiveGetter>(async () => liveNotesError());
    const model = await buildCampaignNotesListModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveCollection,
    });

    expect(model.isAvailable).toBe(false);
    expect(model.httpStatus).toBe(503);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('unavailable');
  });
});

// === Notes detail (issue #10) ===========================================================

describe('campaign note detail via buildCampaignContentPageModel (issue #10)', () => {
  it('blocks anonymous users from a campaignMembers-gated note BEFORE any source fetch', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeNotePageEntry({ visibility: 'public' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'session-zero',
      collectionKey: 'notes',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry,
    });

    expect(model.gate).toBe('campaignMembers');
    expect(model.gateAllowsRequest).toBe(false);
    expect(model.sourceFetched).toBe(false);
    expect(model.canView).toBe(false);
    expect(model.entry).toBeNull();
    expect(getLiveEntry).not.toHaveBeenCalled();
  });

  it('does not let a member view a GM-only note (source returns not found)', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryNotFoundError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'gm-only-note',
      collectionKey: 'notes',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'member',
      getLiveEntry,
    });

    expect(model.gateAllowsRequest).toBe(true);
    expect(model.sourceFetched).toBe(true);
    expect(model.canView).toBe(false);
    expect(model.httpStatus).toBe(404);
    expect(model.reason).toBe('not_found');
  });

  it('lets a GM view a GM-only note', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () =>
      liveEntryResult(makeNotePageEntry({ documentId: 'gm-only-note', visibility: 'gm', title: 'GM Secrets' })),
    );
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'brad',
      documentId: 'gm-only-note',
      collectionKey: 'notes',
      viewer: { kind: 'authenticated', userId: 'user-1', traceId: 'trace-1' },
      getCampaignAccessRole: async () => 'gm' as CampaignAccessRole,
      getLiveEntry,
    });

    expect(model.canView).toBe(true);
    expect(model.visibility).toBe('gm');
    expect(model.entry?.data.title).toBe('GM Secrets');
    const [, filter] = getLiveEntry.mock.calls[0] as [string, Record<string, unknown>];
    expect((filter.accessScope as { allowedVisibilities: string[] }).allowedVisibilities).toEqual([
      'public',
      'campaignMembers',
      'gm',
    ]);
  });

  it('treats a missing note as not found (404, noindex)', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryNotFoundError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      documentId: 'does-not-exist',
      collectionKey: 'notes',
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

  it('treats a source error as 503 (noindex)', async () => {
    const getLiveEntry = vi.fn<CampaignContentPageLiveEntryGetter>(async () => liveEntryUnknownError());
    const model = await buildCampaignContentPageModel({
      campaignSlug: 'public-fixture',
      gateManifest: publicGateManifest,
      documentId: 'session-zero',
      collectionKey: 'notes',
      viewer: { kind: 'anonymous' },
      getCampaignAccessRole: async () => 'anonymous',
      getLiveEntry,
    });

    expect(model.canView).toBe(false);
    expect(model.httpStatus).toBe(503);
    expect(model.robots).toBe('noindex, nofollow');
    expect(model.reason).toBe('unavailable');
  });
});
