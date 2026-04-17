import { describe, expect, it } from 'vitest';
import { buildContentDiscoverySyncPlan, buildContentDiscoverySyncSql } from './content-discovery-writer.mjs';

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
  it('builds a single transactional SQL plan for search and index sync', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [createIndexRow()],
      contentSearchRows: [createSearchRow()],
      managedCollections: ['lore'],
    });

    const sql = buildContentDiscoverySyncSql(plan);

    expect(sql).toContain('BEGIN IMMEDIATE;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(sql).toContain("DELETE FROM content_index WHERE collection = 'lore'");
    expect(sql.indexOf('DELETE FROM content_search')).toBeLessThan(sql.indexOf('DELETE FROM content_index'));
    expect(sql.indexOf('INSERT INTO content_search')).toBeLessThan(sql.indexOf('INSERT INTO content_index'));
  });

  it('returns empty SQL when no managed collections are present', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [],
      contentSearchRows: [],
      managedCollections: [],
    });

    expect(buildContentDiscoverySyncSql(plan)).toBe('');
  });
});
