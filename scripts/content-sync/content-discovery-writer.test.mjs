import { describe, expect, it } from 'vitest';
import { buildContentDiscoverySyncPlan, buildContentDiscoverySyncSql, buildContentDiscoverySyncSqlChunks } from './content-discovery-writer.mjs';
import { buildContributorAttributionSyncPlan, buildAttributionInsertSql } from './contributor-attribution-writer.mjs';

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
    expect(chunks[0]).not.toContain('BEGIN IMMEDIATE;');
    expect(chunks[0]).not.toContain('COMMIT;');
  });

  it('builds one non-transactional file per managed collection by default', () => {
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
    expect(chunks[0]).not.toContain('BEGIN IMMEDIATE;');
    expect(chunks[0]).not.toContain('COMMIT;');
    expect(chunks[0]).toContain("DELETE FROM content_search WHERE collection = 'lore'");
    expect(chunks[0]).not.toContain("DELETE FROM content_search WHERE collection = 'systems'");
    expect(chunks[1]).toContain("DELETE FROM content_search WHERE collection = 'systems'");
    expect(chunks[1]).not.toContain("DELETE FROM content_search WHERE collection = 'lore'");
  });

  it('reconciles contributor registry and attribution rows relationally', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [createIndexRow()],
      contentSearchRows: [createSearchRow()],
      contributorRows: [
        {
          id: 'brad',
          displayName: 'Brad',
          title: 'Brad',
          status: 'publish',
          profileMode: 'standard',
          bioExcerpt: null,
          avatar: null,
          sourceId: 'brad',
          r2Key: 'contributors/brad.md',
          indexedAt: '2026-03-03T00:00:00.000Z',
        },
        {
          id: 'alex',
          displayName: 'Alex',
          title: 'Alex',
          status: 'publish',
          profileMode: 'standard',
          bioExcerpt: null,
          avatar: null,
          sourceId: 'alex',
          r2Key: 'contributors/alex.md',
          indexedAt: '2026-03-03T00:00:00.000Z',
        },
      ],
      attributionRows: [
        {
          contributorId: 'brad',
          targetType: 'content',
          targetCollection: 'lore',
          targetId: 'lore/example',
          role: 'author',
          indexedAt: '2026-03-03T00:00:00.000Z',
        },
        {
          contributorId: 'alex',
          targetType: 'content',
          targetCollection: 'lore',
          targetId: 'lore/example',
          role: 'artist',
          indexedAt: '2026-03-03T00:00:00.000Z',
        },
      ],
      managedCollections: ['contributors', 'lore'],
    });

    const sql = buildContentDiscoverySyncSql(plan);

    expect(sql).toContain('INSERT INTO contributors');
    expect(sql).toContain("DELETE FROM contributors WHERE r2_key IS NOT NULL AND source_id IS NOT NULL AND source_id NOT IN ('alex', 'brad')");
    expect(sql).toContain("DELETE FROM attributions WHERE target_type = 'content' AND target_collection = 'lore'");
    expect(sql).toContain('INSERT INTO attributions');
    expect(sql).not.toContain('contributors_json');
    expect(sql.indexOf('INSERT INTO contributors')).toBeLessThan(sql.indexOf('INSERT INTO attributions'));
    expect(sql.indexOf("DELETE FROM attributions WHERE target_type = 'content' AND target_collection = 'lore'")).toBeLessThan(
      sql.indexOf("DELETE FROM content_index WHERE collection = 'lore'"),
    );
    expect(sql.indexOf("DELETE FROM content_index WHERE collection = 'lore'")).toBeLessThan(sql.indexOf('INSERT INTO attributions'));
  });

  it('dedupes repeated attribution facts before SQL generation', () => {
    const plan = buildContributorAttributionSyncPlan({
      attributionRows: [
        {
          contributorId: 'alex',
          targetType: 'content',
          targetCollection: 'lore',
          targetId: 'lore/example',
          role: 'artist',
          indexedAt: '2026-03-03T00:00:00.000Z',
        },
        {
          contributorId: 'alex',
          targetType: 'content',
          targetCollection: 'lore',
          targetId: 'lore/example',
          role: 'artist',
          indexedAt: '2026-03-04T00:00:00.000Z',
        },
      ],
      managedCollections: ['lore'],
    });

    expect(plan.attributionRows).toHaveLength(1);
    expect(buildAttributionInsertSql(plan).match(/INSERT INTO attributions/g)).toHaveLength(1);
  });

  it('fails contributor-managed sync plans when attributions reference missing contributor profiles', () => {
    expect(() =>
      buildContributorAttributionSyncPlan({
        contributorRows: [
          {
            id: 'brad',
            displayName: 'Brad',
            title: 'Brad',
            status: 'publish',
            profileMode: 'standard',
            bioExcerpt: null,
            avatar: null,
            sourceId: 'brad',
            r2Key: 'contributors/brad.md',
            indexedAt: '2026-03-03T00:00:00.000Z',
          },
        ],
        attributionRows: [
          {
            contributorId: 'alex',
            targetType: 'content',
            targetCollection: 'lore',
            targetId: 'lore/example',
            role: 'artist',
            indexedAt: '2026-03-03T00:00:00.000Z',
          },
        ],
        managedCollections: ['contributors', 'lore'],
      }),
    ).toThrow(/unknown contributor id\(s\): alex/);
  });

  it('fails full discovery sync plans when attribution rows exist without a contributors mapping', () => {
    expect(() =>
      buildContentDiscoverySyncPlan({
        contentIndexRows: [createIndexRow()],
        contentSearchRows: [createSearchRow()],
        attributionRows: [
          {
            contributorId: 'brad',
            targetType: 'content',
            targetCollection: 'lore',
            targetId: 'lore/example',
            role: 'author',
            indexedAt: '2026-03-03T00:00:00.000Z',
          },
        ],
        managedCollections: ['lore'],
      }),
    ).toThrow(/contributors collection is not managed/);
  });

  it('can still build transactional collection chunks when explicitly requested', () => {
    const plan = buildContentDiscoverySyncPlan({
      contentIndexRows: [createIndexRow()],
      contentSearchRows: [createSearchRow()],
      managedCollections: ['lore'],
    });

    const chunks = buildContentDiscoverySyncSqlChunks(plan, { transactional: true });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('BEGIN IMMEDIATE;');
    expect(chunks[0]).toContain('COMMIT;');
  });
});
