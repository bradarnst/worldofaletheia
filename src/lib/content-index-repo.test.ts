import { describe, expect, it } from 'vitest';
import { ContentIndexRepo } from './content-index-repo';
import type { D1DatabaseLike } from './d1';

type QueryHandler = (query: string, values: unknown[], method: 'first' | 'all') => unknown;

function createDbMock(handler: QueryHandler): D1DatabaseLike {
  return {
    prepare(query: string) {
      let boundValues: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return this;
        },
        first<T = Record<string, unknown>>() {
          return Promise.resolve(handler(query, boundValues, 'first') as T | null);
        },
        all<T = Record<string, unknown>>() {
          return Promise.resolve({ results: (handler(query, boundValues, 'all') as T[]) ?? [] });
        },
        run() {
          return Promise.resolve({});
        },
      };
    },
  };
}

describe('ContentIndexRepo', () => {
  it('applies pagination, status filtering, and public visibility guards to list queries', async () => {
    const seenQueries: Array<{ query: string; values: unknown[]; method: 'first' | 'all' }> = [];
    const repo = new ContentIndexRepo(
      createDbMock((query, values, method) => {
        seenQueries.push({ query, values, method });

        if (method === 'first') {
          return { total_count: 23 };
        }

        return [
          {
            id: 'lore/example',
            collection: 'lore',
            slug: 'example',
            title: 'Example',
            type: 'history',
            subtype: null,
            tags_json: '["alpha","beta"]',
            visibility: null,
            campaign_slug: null,
            summary: 'Summary',
            status: 'draft',
            author: 'Brad',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z',
            r2_key: 'content/lore/example.md',
            source_etag: 'etag-1',
            source_last_modified: '2026-03-02T00:00:00.000Z',
            indexed_at: '2026-03-03T00:00:00.000Z',
          },
        ];
      }),
    );

    const result = await repo.listContent({
      collection: 'lore',
      page: 2,
      pageSize: 10,
      environment: 'production',
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 23,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(result.items[0].tags).toEqual(['alpha', 'beta']);

    const [countQuery, listQuery] = seenQueries;
    expect(countQuery.query).toContain("COALESCE(visibility, 'gm') = 'public'");
    expect(countQuery.values).toEqual(['lore', 'publish', 'published', 'review', 'draft']);
    expect(listQuery.query).toContain('ORDER BY updated_at DESC, slug ASC');
    expect(listQuery.values).toEqual(['lore', 'publish', 'published', 'review', 'draft', 10, 10]);
  });

  it('clamps out-of-range pages to the last available page', async () => {
    const seenQueries: Array<{ values: unknown[] }> = [];
    const repo = new ContentIndexRepo(
      createDbMock((query, values, method) => {
        if (method === 'first') {
          return { total_count: 3 };
        }

        seenQueries.push({ values });
        return [];
      }),
    );

    const result = await repo.listContent({
      collection: 'systems',
      page: 9,
      pageSize: 2,
    });

    expect(result.pagination.page).toBe(2);
    expect(seenQueries[0].values.at(-1)).toBe(2);
  });

  it('returns distinct tags with the same public visibility guard', async () => {
    let recordedQuery = '';
    let recordedValues: unknown[] = [];
    const repo = new ContentIndexRepo(
      createDbMock((query, values) => {
        recordedQuery = query;
        recordedValues = values;
        return [
          { value: 'alpha', total_count: 2 },
          { value: 'beta', total_count: 1 },
        ];
      }),
    );

    await expect(repo.listTags({ collection: 'campaigns' })).resolves.toEqual(['alpha', 'beta']);
    expect(recordedQuery).toContain(
      "SELECT tag.value AS value, COUNT(DISTINCT content_index.collection || ':' || content_index.id) AS total_count",
    );
    expect(recordedQuery).toContain("COALESCE(visibility, 'gm') = 'public'");
    expect(recordedValues).toEqual(['campaigns', 'publish', 'published', 'review', 'draft']);
  });

  it('applies the public visibility guard to campaign family collections', async () => {
    let recordedQuery = '';
    let recordedValues: unknown[] = [];
    const repo = new ContentIndexRepo(
      createDbMock((query, values) => {
        recordedQuery = query;
        recordedValues = values;
        return [];
      }),
    );

    await repo.listContent({ collection: 'campaignLore' });

    expect(recordedQuery).toContain("collection NOT LIKE 'campaign%'");
    expect(recordedQuery).toContain("COALESCE(visibility, 'gm') = 'public'");
    expect(recordedValues).toEqual(['campaignLore', 'publish', 'published', 'review', 'draft', 12, 0]);
  });

  it('returns grouped facet counts for type queries', async () => {
    const repo = new ContentIndexRepo(
      createDbMock((query, values) => {
        expect(query).toContain('SELECT type AS value, COUNT(*) AS total_count');
        expect(values).toEqual(['systems', 'publish', 'published', 'review', 'draft']);
        return [
          { value: 'general', total_count: 3 },
          { value: 'gurps', total_count: 7 },
        ];
      }),
    );

    await expect(repo.listTypeCounts({ collection: 'systems' })).resolves.toEqual([
      { value: 'general', count: 3 },
      { value: 'gurps', count: 7 },
    ]);
  });

  it('searches metadata fields with escaped LIKE terms and pagination', async () => {
    const seenQueries: Array<{ query: string; values: unknown[]; method: 'first' | 'all' }> = [];
    const repo = new ContentIndexRepo(
      createDbMock((query, values, method) => {
        seenQueries.push({ query, values, method });

        if (method === 'first') {
          return { total_count: 1 };
        }

        return [
          {
            id: 'systems/gurps-magic',
            collection: 'systems',
            slug: 'gurps-magic',
            title: 'GURPS Magic',
            type: 'gurps',
            subtype: 'magic',
            tags_json: '["gurps","magic"]',
            visibility: null,
            campaign_slug: null,
            summary: 'Magic rules',
            status: 'publish',
            author: 'Brad',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z',
            r2_key: 'content/systems/gurps-magic.md',
            source_etag: 'etag-1',
            source_last_modified: '2026-03-02T00:00:00.000Z',
            indexed_at: '2026-03-03T00:00:00.000Z',
          },
        ];
      }),
    );

    const result = await repo.searchContent({
      query: 'magic gurps',
      collection: 'systems',
      page: 1,
      pageSize: 5,
    });

    expect(result.pagination.totalItems).toBe(1);
    expect(result.items[0]?.slug).toBe('gurps-magic');
    expect(seenQueries[0]?.query).toContain("LOWER(title) LIKE ? ESCAPE '\\'");
    expect(seenQueries[0]?.values).toEqual([
      'systems',
      'publish',
      'published',
      'review',
      'draft',
      '%magic%',
      '%magic%',
      '%magic%',
      '%magic%',
      '%magic%',
      '%magic%',
      '%gurps%',
      '%gurps%',
      '%gurps%',
      '%gurps%',
      '%gurps%',
      '%gurps%',
    ]);
    expect(seenQueries[1]?.values.slice(-2)).toEqual([5, 0]);
  });
});
