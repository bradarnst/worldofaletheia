import { describe, expect, it } from 'vitest';
import {
  buildContentIndexSql,
  buildContentIndexSyncPlan,
  resolveContentIndexSyncTarget,
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
    r2Key: 'content/lore/example.md',
    sourceEtag: 'etag-1',
    sourceLastModified: '2026-03-02T00:00:00.000Z',
    indexedAt: '2026-03-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('content index writer', () => {
  it('keeps protected campaign-domain rows so D1 remains the object lookup source', () => {
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

    expect(plan.rows.map((row) => `${row.collection}:${row.id}`)).toEqual([
      'campaignLore:brad/lore/river-omens',
      'campaigns:campaigns/brad/index',
      'lore:lore/example',
      'sessions:brad/sessions/intro',
    ]);
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
    expect(sql).toContain('ON CONFLICT(collection, id) DO UPDATE SET');
    expect(sql).toContain('CASE WHEN excluded.r2_key IS NOT NULL AND excluded.r2_key');
    expect(sql).toContain("content/lore/example.md");
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

  it('retains managed collection ordering without dedupe loss', () => {
    const plan = buildContentIndexSyncPlan({
      rows: [createRow({ collection: 'campaignHooks', id: 'brad/hooks/missing-heir' }), createRow()],
      managedCollections: ['lore', 'campaignHooks', 'lore'],
    });

    expect(plan.managedCollections).toEqual(['campaignHooks', 'lore']);
  });

  it('does not overwrite r2_key with an empty value during upsert', () => {
    // Simulate a partial sync row that has an empty r2Key (e.g. failed R2 upload)
    const plan = buildContentIndexSyncPlan({
      rows: [
        createRow({ r2Key: '' }),
      ],
      managedCollections: ['lore'],
    });

    const sql = buildContentIndexSql(plan);

    // The CASE expression must guard against writing empty r2_key over a populated one
    expect(sql).toContain('CASE WHEN excluded.r2_key IS NOT NULL AND excluded.r2_key');
    expect(sql).toContain('ELSE content_index.r2_key END');
    // Ensure the upsert does not do a plain overwrite of r2_key
    expect(sql).not.toMatch(/r2_key = excluded\.r2_key[,\n]/);
  });

  it('keeps same ids from different collections as distinct upsert rows', () => {
    const plan = buildContentIndexSyncPlan({
      rows: [
        createRow({ collection: 'lore', id: 'shared/entry', slug: 'shared-entry' }),
        createRow({ collection: 'systems', id: 'shared/entry', slug: 'shared-entry', r2Key: 'content/systems/shared-entry.md' }),
      ],
      managedCollections: ['systems', 'lore'],
    });

    expect(plan.rows.map((row) => `${row.collection}:${row.id}`)).toEqual([
      'lore:shared/entry',
      'systems:shared/entry',
    ]);

    const sql = buildContentIndexSql(plan);

    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'lore'");
    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'systems'");
    expect(sql).toContain("content/lore/example.md");
    expect(sql).toContain("content/systems/shared-entry.md");
    expect(sql.match(/ON CONFLICT\(collection, id\) DO UPDATE SET/g)).toHaveLength(2);
  });
});
