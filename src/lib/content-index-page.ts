import { getCollection } from 'astro:content';
import { ContentIndexRepo, type ContentIndexPagination } from './content-index-repo';
import { tryGetD1BindingFromLocals } from './d1';
import { getFilteredCollection, type ContentEnvironment } from '~/utils/content-filter';

export type IndexBackedCollectionName = 'lore' | 'places' | 'sentients' | 'systems';

interface LocalCollectionData {
  title?: string;
  excerpt?: string;
  tags?: string[];
  status?: string;
  author?: string;
  campaign?: string;
  created?: Date;
  'created-date'?: Date;
  modified?: Date;
  'modified-date'?: Date;
}

interface LocalCollectionEntry {
  id: string;
  collection: string;
  data: LocalCollectionData;
}

export interface ContentCardEntry {
  id: string;
  collection: string;
  data: {
    title: string;
    excerpt?: string;
    tags: string[];
    status?: string;
    author?: string;
    campaign?: string;
    created: Date;
  };
}

export interface IndexBackedCollectionPageData {
  cards: ContentCardEntry[];
  tags: string[];
  pagination: ContentIndexPagination;
  mode: 'index' | 'local' | 'error';
  errorMessage: string | null;
}

function pickDisplayDate(data: LocalCollectionData): Date {
  return data.created ?? data['created-date'] ?? data.modified ?? data['modified-date'] ?? new Date(0);
}

function normalizePage(value: string | null): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function createPagination(totalItems: number, requestedPage: number, pageSize: number): ContentIndexPagination {
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

function mapLocalEntryToCard(entry: LocalCollectionEntry): ContentCardEntry {
  return {
    id: entry.id,
    collection: entry.collection,
    data: {
      title: entry.data.title ?? entry.id,
      excerpt: entry.data.excerpt,
      tags: entry.data.tags ?? [],
      status: entry.data.status,
      author: entry.data.author,
      campaign: entry.data.campaign,
      created: pickDisplayDate(entry.data),
    },
  };
}

export async function loadIndexBackedCollectionPage(options: {
  collection: IndexBackedCollectionName;
  pageParam: string | null;
  locals: unknown;
  pageSize?: number;
  environment?: ContentEnvironment;
}): Promise<IndexBackedCollectionPageData> {
  const pageSize = options.pageSize ?? 12;
  const requestedPage = normalizePage(options.pageParam);
  const environment = options.environment ?? 'production';
  const db = tryGetD1BindingFromLocals(options.locals);

  if (!db) {
    const fallbackCollection = getFilteredCollection(
      (await getCollection(options.collection)) as LocalCollectionEntry[],
      environment,
    ).sort((left, right) => {
      const timeDifference = pickDisplayDate(right.data).getTime() - pickDisplayDate(left.data).getTime();
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.id.localeCompare(right.id);
    });
    const pagination = createPagination(fallbackCollection.length, requestedPage, pageSize);
    const start = (pagination.page - 1) * pageSize;
    const end = start + pageSize;

    return {
      cards: fallbackCollection.slice(start, end).map(mapLocalEntryToCard),
      tags: [...new Set(fallbackCollection.flatMap((entry) => entry.data.tags ?? []))].sort((left, right) =>
        left.localeCompare(right),
      ),
      pagination,
      mode: 'local',
      errorMessage: null,
    };
  }

  try {
    const repo = new ContentIndexRepo(db);
    const [listResult, tags] = await Promise.all([
      repo.listContent({
        collection: options.collection,
        page: requestedPage,
        pageSize,
        environment,
      }),
      repo.listTags({
        collection: options.collection,
        environment,
      }),
    ]);

    return {
      cards: listResult.items.map((item) => ({
        id: item.id,
        collection: item.collection,
        data: {
          title: item.title,
          excerpt: item.summary ?? undefined,
          tags: item.tags,
          status: item.status ?? undefined,
          author: item.author ?? undefined,
          campaign: item.campaignSlug ?? undefined,
          created: new Date(item.createdAt ?? item.updatedAt ?? item.sourceLastModified),
        },
      })),
      tags,
      pagination: listResult.pagination,
      mode: 'index',
      errorMessage: null,
    };
  } catch (error) {
    console.error('content.index.query_failed', {
      collection: options.collection,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return {
      cards: [],
      tags: [],
      pagination: createPagination(0, requestedPage, pageSize),
      mode: 'error',
      errorMessage: 'Discovery data is temporarily unavailable. Try again from the Cloudflare parity lane or after the next sync run.',
    };
  }
}
