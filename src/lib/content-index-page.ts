import { getCollection } from 'astro:content';
import {
  ContentIndexRepo,
  type ContentIndexFacetCount,
  type ContentIndexPagination,
  type ContentIndexRow,
} from './content-index-repo';
import { tryGetD1BindingFromLocals } from './d1';
import { getFilteredCollection, type ContentEnvironment } from '~/utils/content-filter';
import { normalizeFilterValue, normalizePage, normalizeView, type DiscoveryViewMode } from './normalizers';

export type IndexBackedCollectionName = 'lore' | 'places' | 'sentients' | 'systems';
type DiscoveryGroupField = 'type' | 'subtype';

interface LocalCollectionData {
  title?: string;
  type?: string;
  subtype?: string;
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
    type?: string;
    subtype?: string;
    excerpt?: string;
    tags: string[];
    status?: string;
    author?: string;
    campaign?: string;
    created: Date;
  };
}

export interface DiscoveryFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface DiscoveryGroupPreview {
  value: string;
  label: string;
  count: number;
  field: DiscoveryGroupField;
  items: ContentCardEntry[];
}

export interface DiscoveryFilters {
  page: number;
  view: DiscoveryViewMode;
  type: string | null;
  subtype: string | null;
  tag: string | null;
}

export interface IndexBackedCollectionPageData {
  cards: ContentCardEntry[];
  groups: DiscoveryGroupPreview[];
  facets: {
    types: DiscoveryFacetOption[];
    subtypes: DiscoveryFacetOption[];
    tags: DiscoveryFacetOption[];
  };
  filters: DiscoveryFilters;
  pagination: ContentIndexPagination;
  mode: 'index' | 'local' | 'error';
  errorMessage: string | null;
}

function pickDisplayDate(data: LocalCollectionData): Date {
  return data.created ?? data['created-date'] ?? data.modified ?? data['modified-date'] ?? new Date(0);
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

function sortLocalEntries(entries: LocalCollectionEntry[]): LocalCollectionEntry[] {
  return [...entries].sort((left, right) => {
    const timeDifference = pickDisplayDate(right.data).getTime() - pickDisplayDate(left.data).getTime();
    if (timeDifference !== 0) {
      return timeDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

function formatDiscoveryLabel(value: string): string {
  return value
    .split(/[_-]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(' ');
}

function mapFacetCounts(counts: ContentIndexFacetCount[]): DiscoveryFacetOption[] {
  return counts.map((count) => ({
    value: count.value,
    label: formatDiscoveryLabel(count.value),
    count: count.count,
  }));
}

function mapLocalEntryToCard(entry: LocalCollectionEntry): ContentCardEntry {
  return {
    id: entry.id,
    collection: entry.collection,
    data: {
      title: entry.data.title ?? entry.id,
      type: entry.data.type,
      subtype: entry.data.subtype,
      excerpt: entry.data.excerpt,
      tags: entry.data.tags ?? [],
      status: entry.data.status,
      author: entry.data.author,
      campaign: entry.data.campaign,
      created: pickDisplayDate(entry.data),
    },
  };
}

function mapIndexRowToCard(row: ContentIndexRow): ContentCardEntry {
  return {
    id: row.slug,
    collection: row.collection,
    data: {
      title: row.title,
      type: row.type ?? undefined,
      subtype: row.subtype ?? undefined,
      excerpt: row.summary ?? undefined,
      tags: row.tags,
      status: row.status ?? undefined,
      author: row.author ?? undefined,
      campaign: row.campaignSlug ?? undefined,
      created: new Date(row.createdAt ?? row.updatedAt ?? row.sourceLastModified),
    },
  };
}

function parseFilters(searchParams: URLSearchParams): DiscoveryFilters {
  return {
    page: normalizePage(searchParams.get('page')),
    view: normalizeView(searchParams.get('view')),
    type: normalizeFilterValue(searchParams.get('type')),
    subtype: normalizeFilterValue(searchParams.get('subtype')),
    tag: normalizeFilterValue(searchParams.get('tag')),
  };
}

function applyLocalFilters(entries: LocalCollectionEntry[], filters: DiscoveryFilters): LocalCollectionEntry[] {
  return entries.filter((entry) => {
    if (filters.type && entry.data.type !== filters.type) {
      return false;
    }

    if (filters.subtype && entry.data.subtype !== filters.subtype) {
      return false;
    }

    if (filters.tag && !(entry.data.tags ?? []).includes(filters.tag)) {
      return false;
    }

    return true;
  });
}

function buildFacetOptions(values: string[]): DiscoveryFacetOption[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({
      value,
      label: formatDiscoveryLabel(value),
      count,
    }));
}

function determineGroupField(filters: DiscoveryFilters, subtypes: DiscoveryFacetOption[]): DiscoveryGroupField {
  if (filters.type && subtypes.length > 0) {
    return 'subtype';
  }

  return 'type';
}

function buildLocalGroups(
  entries: LocalCollectionEntry[],
  filters: DiscoveryFilters,
  subtypes: DiscoveryFacetOption[],
  previewSize: number,
): DiscoveryGroupPreview[] {
  const groupField = determineGroupField(filters, subtypes);
  const grouped = new Map<string, LocalCollectionEntry[]>();

  for (const entry of entries) {
    const value = entry.data[groupField];
    if (!value) {
      continue;
    }

    const existing = grouped.get(value) ?? [];
    existing.push(entry);
    grouped.set(value, existing);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, groupedEntries]) => ({
      value,
      label: formatDiscoveryLabel(value),
      count: groupedEntries.length,
      field: groupField,
      items: sortLocalEntries(groupedEntries).slice(0, previewSize).map(mapLocalEntryToCard),
    }));
}

export async function loadIndexBackedCollectionPage(options: {
  collection: IndexBackedCollectionName;
  searchParams: URLSearchParams;
  locals: unknown;
  pageSize?: number;
  groupPreviewSize?: number;
  environment?: ContentEnvironment;
}): Promise<IndexBackedCollectionPageData> {
  const pageSize = options.pageSize ?? 12;
  const groupPreviewSize = options.groupPreviewSize ?? 3;
  const filters = parseFilters(options.searchParams);
  const environment = options.environment ?? 'production';
  const db = tryGetD1BindingFromLocals(options.locals);

  if (!db) {
    const collection = sortLocalEntries(
      getFilteredCollection((await getCollection(options.collection)) as LocalCollectionEntry[], environment),
    );
    const filteredCollection = applyLocalFilters(collection, filters);
    const facets = {
      types: buildFacetOptions(filteredCollection.map((entry) => entry.data.type).filter((value): value is string => !!value)),
      subtypes: buildFacetOptions(
        filteredCollection.map((entry) => entry.data.subtype).filter((value): value is string => !!value),
      ),
      tags: buildFacetOptions(filteredCollection.flatMap((entry) => entry.data.tags ?? [])),
    };

    const pagination = createPagination(filteredCollection.length, filters.page, pageSize);
    const start = (pagination.page - 1) * pageSize;
    const end = start + pageSize;

    return {
      cards: filters.view === 'latest' ? filteredCollection.slice(start, end).map(mapLocalEntryToCard) : [],
      groups:
        filters.view === 'grouped'
          ? buildLocalGroups(filteredCollection, filters, facets.subtypes, groupPreviewSize)
          : [],
      facets,
      filters,
      pagination,
      mode: 'local',
      errorMessage: null,
    };
  }

  try {
    const repo = new ContentIndexRepo(db);
    const baseFilters = {
      collection: options.collection,
      environment,
      type: filters.type ?? undefined,
      subtype: filters.subtype ?? undefined,
      tags: filters.tag ? [filters.tag] : undefined,
    };

    const [types, subtypes, tags] = await Promise.all([
      repo.listTypeCounts(baseFilters),
      repo.listSubtypeCounts(baseFilters),
      repo.listTagCounts(baseFilters),
    ]);
    const mappedTypes = mapFacetCounts(types);
    const mappedSubtypes = mapFacetCounts(subtypes);
    const mappedTags = mapFacetCounts(tags);

    if (filters.view === 'grouped') {
      const groupField = determineGroupField(filters, mappedSubtypes);
      const groupFacets = groupField === 'subtype' ? mappedSubtypes : mappedTypes;
      const groups = await Promise.all(
        groupFacets.map(async (facet) => {
          const items = await repo.listPreviewContent({
            ...baseFilters,
            type: groupField === 'type' ? facet.value : baseFilters.type,
            subtype: groupField === 'subtype' ? facet.value : baseFilters.subtype,
            limit: groupPreviewSize,
          });

          return {
            value: facet.value,
            label: facet.label,
            count: facet.count,
            field: groupField,
            items: items.map(mapIndexRowToCard),
          } satisfies DiscoveryGroupPreview;
        }),
      );

      return {
        cards: [],
        groups,
        facets: {
          types: mappedTypes,
          subtypes: mappedSubtypes,
          tags: mappedTags,
        },
        filters,
        pagination: createPagination(groups.reduce((sum, group) => sum + group.count, 0), 1, pageSize),
        mode: 'index',
        errorMessage: null,
      };
    }

    const listResult = await repo.listContent({
      ...baseFilters,
      page: filters.page,
      pageSize,
    });

    return {
      cards: listResult.items.map(mapIndexRowToCard),
      groups: [],
      facets: {
        types: mappedTypes,
        subtypes: mappedSubtypes,
        tags: mappedTags,
      },
      filters,
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
      groups: [],
      facets: {
        types: [],
        subtypes: [],
        tags: [],
      },
      filters,
      pagination: createPagination(0, filters.page, pageSize),
      mode: 'error',
      errorMessage: 'Discovery data is temporarily unavailable. Try again from the Cloudflare parity lane or after the next sync run.',
    };
  }
}
