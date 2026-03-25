import { describe, expect, it } from 'vitest';
import {
  buildContentIndexSql,
  buildContentIndexSyncPlan,
  resolveContentIndexSyncTarget,
  shouldIndexForPublicDiscovery,
} from './content-index-writer.mjs';

function createRow(overrides = {}) {
  return {
    id: 'lore/example',
    collection: 'lore',
    slug: 'example',
    title: 'Example',
    type: 'history',
    subtype: null,
    tagsJson: '["alpha"]',
    visibility: null,
    campaignSlug: null,
    summary: 'Summary',
    status: 'draft',
    author: 'Brad',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
    sourceEtag: 'etag-1',
    sourceLastModified: '2026-03-02T00:00:00.000Z',
    indexedAt: '2026-03-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('content index writer', () => {
  it('skips protected campaign-domain rows from the public discovery plan', () => {
    const publicLore = createRow();
    const protectedCampaign = createRow({
      id: 'campaigns/brad/index',
      collection: 'campaigns',
      slug: 'brad',
      visibility: 'gm',
      campaignSlug: 'brad',
      status: null,
    });
    const publicSession = createRow({
      id: 'brad/sessions/intro',
      collection: 'sessions',
      slug: 'intro',
      visibility: 'public',
      campaignSlug: 'brad',
      status: 'draft',
    });
    const protectedCampaignLore = createRow({
      id: 'brad/lore/river-omens',
      collection: 'campaignLore',
      slug: 'river-omens',
      visibility: 'campaignMembers',
      campaignSlug: 'brad',
      status: 'publish',
    });

    const plan = buildContentIndexSyncPlan({
      rows: [protectedCampaign, publicSession, protectedCampaignLore, publicLore],
      managedCollections: ['sessions', 'campaignLore', 'campaigns', 'lore'],
    });

    expect(plan.rows.map((row) => row.id)).toEqual(['brad/sessions/intro', 'lore/example']);
    expect(plan.skippedRows.map((row) => row.id)).toEqual(['campaigns/brad/index', 'brad/lore/river-omens']);
    expect(plan.skippedByCollection).toEqual({ campaigns: 1, campaignLore: 1 });
  });

  it('builds upsert and reconciliation SQL for managed collections', () => {
    const plan = buildContentIndexSyncPlan({
      rows: [
        createRow({ id: "lore/king's-road", slug: "king's-road", title: "King's Road" }),
      ],
      managedCollections: ['lore'],
    });

    const sql = buildContentIndexSql(plan);

    expect(sql).toContain('INSERT INTO content_index');
    expect(sql).toContain("King''s Road");
    expect(sql).toContain('DELETE FROM content_index');
    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'lore'");
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(sql).not.toContain('BEGIN TRANSACTION');
    expect(sql).not.toContain('COMMIT;');
    expect(sql).not.toContain('__content_index_sync_collections');
    expect(sql).not.toContain('__content_index_sync_ids');
  });

  it('supports explicit remote and off target configuration', () => {
    expect(resolveContentIndexSyncTarget({})).toEqual({
      enabled: true,
      mode: 'local',
      envName: null,
    });

    expect(
      resolveContentIndexSyncTarget({
        CONTENT_INDEX_SYNC_MODE: 'remote',
        CONTENT_INDEX_SYNC_ENV: 'staging',
      }),
    ).toEqual({
      enabled: true,
      mode: 'remote',
      envName: 'staging',
    });

    expect(
      resolveContentIndexSyncTarget({
        CONTENT_INDEX_SYNC_MODE: 'off',
      }),
    ).toEqual({
      enabled: false,
      mode: 'local',
      envName: null,
    });
  });

  it('treats non-campaign rows as indexable by default', () => {
    expect(shouldIndexForPublicDiscovery(createRow())).toBe(true);
    expect(
      shouldIndexForPublicDiscovery(
        createRow({
          collection: 'campaignHooks',
          id: 'brad/hooks/missing-heir',
          visibility: 'campaignMembers',
        }),
      ),
    ).toBe(false);
  });
});
