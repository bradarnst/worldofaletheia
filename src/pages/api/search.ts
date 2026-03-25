import type { APIRoute } from 'astro';
import { createContentIndexRepoFromLocals, type ContentIndexRow } from '~/lib/content-index-repo';
import { normalizeFilterValueOptional, normalizePage } from '~/lib/normalizers';

function normalizePageSize(value: string | null): number {
  const parsed = Number.parseInt(value ?? '10', 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 10;
  }

  return Math.min(parsed, 25);
}

function normalizeTags(searchParams: URLSearchParams): string[] | undefined {
  const tags = [...new Set(searchParams.getAll('tag').flatMap((value) => value.split(',')).map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
  return tags.length > 0 ? tags : undefined;
}

function buildHref(item: ContentIndexRow): string {
  if (item.collection === 'campaigns') {
    return `/campaigns/${item.slug}`;
  }

  if (item.collection === 'sessions') {
    return item.campaignSlug ? `/campaigns/${item.campaignSlug}/sessions/${item.slug}` : `/sessions/${item.slug}`;
  }

  return `/${item.collection}/${item.slug}`;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_query' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const repo = createContentIndexRepoFromLocals(locals);
    const result = await repo.searchContent({
      query,
      collection: normalizeFilterValueOptional(url.searchParams.get('collection')),
      type: normalizeFilterValueOptional(url.searchParams.get('type')),
      subtype: normalizeFilterValueOptional(url.searchParams.get('subtype')),
      tags: normalizeTags(url.searchParams),
      page: normalizePage(url.searchParams.get('page')),
      pageSize: normalizePageSize(url.searchParams.get('pageSize')),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        query,
        pagination: result.pagination,
        items: result.items.map((item) => ({
          id: item.id,
          collection: item.collection,
          slug: item.slug,
          href: buildHref(item),
          title: item.title,
          summary: item.summary,
          type: item.type,
          subtype: item.subtype,
          tags: item.tags,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('search.index.query_failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return new Response(JSON.stringify({ ok: false, error: 'unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
};
