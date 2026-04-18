import { describe, expect, it } from 'vitest';
import { buildContentDiscoverySyncPlan, buildContentDiscoverySyncSql, buildContentDiscoverySyncSqlChunks } from './content-discovery-writer.mjs';

function createIndexRow(overrides = {}) {
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

function createSearchRow(overrides = {}) {
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

describe('content discovery writer', () => {
  it('can still build a transactional SQL plan when explicitly requested', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [createIndexRow()],
      contentSearchRows: [createSearchRow()],
      managedCollections: ['lore'],
    });

    const sql = buildContentDiscoverySyncSql(plan, { transactional: true });

    expect(sql).toContain('BEGIN IMMEDIATE;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'lore'");
    expect(sql.indexOf('DELETE FROM content_search')).toBeLessThan(sql.indexOf('DELETE FROM content_index'));
    expect(sql.indexOf('INSERT INTO content_search')).toBeLessThan(sql.indexOf('INSERT INTO content_index'));
  });

  it('can build a non-transactional SQL plan for local D1 execution', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [createIndexRow()],
      contentSearchRows: [createSearchRow()],
      managedCollections: ['lore'],
    });

    const sql = buildContentDiscoverySyncSql(plan);

    expect(sql).not.toContain('BEGIN IMMEDIATE;');
    expect(sql).not.toContain('COMMIT;');
    expect(sql).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'lore'");
  });

  it('returns empty SQL when no managed collections are present', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [],
      contentSearchRows: [],
      managedCollections: [],
    });

    expect(buildContentDiscoverySyncSql(plan)).toBe('');
  });

  it('emits a delete-only collection chunk when a managed collection has no rows', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [],
      contentSearchRows: [],
      managedCollections: ['lore'],
    });

    const chunks = buildContentDiscoverySyncSqlChunks(plan);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(chunks[0]).toContain("DELETE FROM content_index WHERE collection = 'lore'");
    expect(chunks[0]).toContain('BEGIN IMMEDIATE;');
    expect(chunks[0]).toContain('COMMIT;');
  });

  it('builds one transactional file per managed collection', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [
        createIndexRow(),
        createIndexRow({ collection: 'systems', id: 'systems/example', slug: 'systems-example', title: 'Systems Example' }),
      ],
      contentSearchRows: [
        createSearchRow(),
        createSearchRow({ collection: 'systems', id: 'systems/example', slug: 'systems-example', title: 'Systems Example' }),
      ],
      managedCollections: ['systems', 'lore'],
    });

    const chunks = buildContentDiscoverySyncSqlChunks(plan);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain('BEGIN IMMEDIATE;');
    expect(chunks[0]).toContain('COMMIT;');
    expect(chunks[0]).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(chunks[0]).not.toContain("DELETE FROM content_search WHERE collection = 'systems'");
    expect(chunks[1]).toContain("DELETE FROM content_search WHERE collection = 'systems'");
    expect(chunks[1]).not.toContain("DELETE FROM content_search WHERE collection = 'lore'");
  });
});
