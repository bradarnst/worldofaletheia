import { describe, expect, it } from 'vitest';
import {
  buildContentSearchSql,
  buildContentSearchSyncPlan,
  resolveContentSearchSyncTarget,
} from './content-search-writer.mjs';

function createRow(overrides = {}) {
  return {
    collection: 'lore',
    id: 'lore/example',
    slug: 'example',
    title: 'Example',
    summary: 'Summary',
    type: 'history',
    subtype: null,
    tagsText: 'alpha beta',
    bodyText: 'Example body text',
    ...overrides,
  };
}

describe('content search writer', () => {
  it('sorts search rows by collection and id', () => {
    const plan = buildContentSearchSyncPlan({
      rows: [createRow({ collection: 'systems', id: 'systems/example' }), createRow()],
      managedCollections: ['systems', 'lore'],
    });

    expect(plan.rows.map((row) => `${row.collection}:${row.id}`)).toEqual([
      'lore:lore/example',
      'systems:systems/example',
    ]);
  });

  it('builds reconciliation SQL for managed collections', () => {
    const plan = buildContentSearchSyncPlan({
      rows: [createRow({ id: "lore/king's-road", slug: "king's-road", title: "King's Road" })],
      managedCollections: ['lore'],
    });

    const sql = buildContentSearchSql(plan);

    expect(sql).toContain('DELETE FROM content_search');
    expect(sql).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(sql).toContain('INSERT INTO content_search');
    expect(sql).toContain('ON CONFLICT(collection, id) DO UPDATE SET');
    expect(sql).toContain("King''s Road");
    expect(sql).toContain('body_text = excluded.body_text');
  });

  it('supports explicit remote and off target configuration', () => {
    expect(resolveContentSearchSyncTarget({})).toEqual({
      enabled: true,
      mode: 'local',
      envName: null,
    });

    expect(
      resolveContentSearchSyncTarget({
        CONTENT_INDEX_SYNC_MODE: 'remote',
        CONTENT_INDEX_SYNC_ENV: 'staging',
      }),
    ).toEqual({
      enabled: true,
      mode: 'remote',
      envName: 'staging',
    });

    expect(
      resolveContentSearchSyncTarget({
        CONTENT_INDEX_SYNC_MODE: 'off',
      }),
    ).toEqual({
      enabled: false,
      mode: 'local',
      envName: null,
    });
  });
});
