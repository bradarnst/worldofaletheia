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
    expect(listQuery.query).toContain('ORDER BY COALESCE(updated_at, source_last_modified) DESC, slug ASC');
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
        return [{ tag: 'alpha' }, { tag: 'beta' }];
      }),
    );

    await expect(repo.listTags({ collection: 'campaigns' })).resolves.toEqual(['alpha', 'beta']);
    expect(recordedQuery).toContain('SELECT DISTINCT tag.value AS tag');
    expect(recordedQuery).toContain("COALESCE(visibility, 'gm') = 'public'");
    expect(recordedValues).toEqual(['campaigns', 'publish', 'published', 'review', 'draft']);
  });
});
