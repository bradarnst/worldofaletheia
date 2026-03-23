import { type ContentEnvironment, getIncludedStatuses } from '~/utils/content-filter';
import { type D1DatabaseLike, getD1BindingFromLocals } from './d1';

type ContentIndexVisibility = 'public' | 'campaignMembers' | 'gm';

interface CountRow {
  total_count: number | string;
}

interface TagRow {
  tag: string | null;
}

interface ContentIndexRowRecord {
  id: string;
  collection: string;
  slug: string;
  title: string;
  type: string | null;
  subtype: string | null;
  tags_json: string | null;
  visibility: ContentIndexVisibility | null;
  campaign_slug: string | null;
  summary: string | null;
  status: string | null;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_etag: string;
  source_last_modified: string;
  indexed_at: string;
}

export interface ContentIndexRow {
  id: string;
  collection: string;
  slug: string;
  title: string;
  type: string | null;
  subtype: string | null;
  tags: string[];
  visibility: ContentIndexVisibility | null;
  campaignSlug: string | null;
  summary: string | null;
  status: string | null;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sourceEtag: string;
  sourceLastModified: string;
  indexedAt: string;
}

export interface ContentIndexFilters {
  collection: string;
  type?: string;
  subtype?: string;
  tags?: string[];
  environment?: ContentEnvironment;
  visibilityScope?: 'public';
}

export interface ContentIndexListOptions extends ContentIndexFilters {
  page?: number;
  pageSize?: number;
}

export interface ContentIndexPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ContentIndexListResult {
  items: ContentIndexRow[];
  pagination: ContentIndexPagination;
}

function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizePageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 12;
  }

  return Math.min(Math.floor(value), 100);
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function parseTagsJson(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    return [];
  }
}

function toContentIndexRow(record: ContentIndexRowRecord): ContentIndexRow {
  return {
    id: record.id,
    collection: record.collection,
    slug: record.slug,
    title: record.title,
    type: record.type,
    subtype: record.subtype,
    tags: parseTagsJson(record.tags_json),
    visibility: record.visibility,
    campaignSlug: record.campaign_slug,
    summary: record.summary,
    status: record.status,
    author: record.author,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    sourceEtag: record.source_etag,
    sourceLastModified: record.source_last_modified,
    indexedAt: record.indexed_at,
  };
}

function buildWhereClause(filters: ContentIndexFilters): { sql: string; values: unknown[] } {
  const clauses = ['collection = ?'];
  const values: unknown[] = [filters.collection];
  const statuses = getIncludedStatuses(filters.environment ?? 'production');

  clauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
  values.push(...statuses);

  if (filters.type) {
    clauses.push('type = ?');
    values.push(filters.type);
  }

  if (filters.subtype) {
    clauses.push('subtype = ?');
    values.push(filters.subtype);
  }

  const tags = normalizeTags(filters.tags);
  if (tags.length > 0) {
    clauses.push(
      `EXISTS (SELECT 1 FROM json_each(content_index.tags_json) AS tag WHERE tag.value IN (${tags
        .map(() => '?')
        .join(', ')}))`,
    );
    values.push(...tags);
  }

  if ((filters.visibilityScope ?? 'public') === 'public') {
    clauses.push(`(collection NOT IN ('campaigns', 'sessions') OR COALESCE(visibility, 'gm') = 'public')`);
  }

  return {
    sql: clauses.join(' AND '),
    values,
  };
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

export class ContentIndexRepo {
  constructor(private readonly db: D1DatabaseLike) {}

  async listContent(options: ContentIndexListOptions): Promise<ContentIndexListResult> {
    const requestedPage = normalizePage(options.page);
    const pageSize = normalizePageSize(options.pageSize);
    const where = buildWhereClause(options);

    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM content_index
      WHERE ${where.sql}
    `;
    const countRow = await this.db.prepare(countQuery).bind(...where.values).first<CountRow>();
    const totalItems = Number(countRow?.total_count ?? 0);
    const pagination = createPagination(totalItems, requestedPage, pageSize);
    const offset = (pagination.page - 1) * pageSize;

    const listQuery = `
      SELECT
        id,
        collection,
        slug,
        title,
        type,
        subtype,
        tags_json,
        visibility,
        campaign_slug,
        summary,
        status,
        author,
        created_at,
        updated_at,
        source_etag,
        source_last_modified,
        indexed_at
      FROM content_index
      WHERE ${where.sql}
      ORDER BY COALESCE(updated_at, source_last_modified) DESC, slug ASC
      LIMIT ? OFFSET ?
    `;
    const result = await this.db
      .prepare(listQuery)
      .bind(...where.values, pageSize, offset)
      .all<ContentIndexRowRecord>();

    return {
      items: result.results.map(toContentIndexRow),
      pagination,
    };
  }

  async listTags(filters: ContentIndexFilters): Promise<string[]> {
    const where = buildWhereClause(filters);
    const query = `
      SELECT DISTINCT tag.value AS tag
      FROM content_index, json_each(content_index.tags_json) AS tag
      WHERE ${where.sql}
        AND tag.value IS NOT NULL
        AND tag.value <> ''
      ORDER BY tag.value ASC
    `;
    const result = await this.db.prepare(query).bind(...where.values).all<TagRow>();
    return result.results
      .map((row) => row.tag)
      .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
  }
}

export function createContentIndexRepoFromLocals(locals: unknown): ContentIndexRepo {
  return new ContentIndexRepo(getD1BindingFromLocals(locals));
}
