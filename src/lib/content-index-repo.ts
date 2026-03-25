import { type ContentEnvironment, getIncludedStatuses } from '~/utils/content-filter';
import { type D1DatabaseLike, getD1BindingFromLocals } from './d1';

type ContentIndexVisibility = 'public' | 'campaignMembers' | 'gm';

interface CountRow {
  total_count: number | string;
}

interface FacetRow {
  value: string | null;
  total_count?: number | string;
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

interface ContentIndexBaseFilters {
  collection?: string;
  type?: string;
  subtype?: string;
  tags?: string[];
  environment?: ContentEnvironment;
  visibilityScope?: 'public';
}

export interface ContentIndexFilters extends ContentIndexBaseFilters {
  collection: string;
}

export interface ContentIndexListOptions extends ContentIndexFilters {
  page?: number;
  pageSize?: number;
}

export interface ContentIndexPreviewOptions extends ContentIndexBaseFilters {
  limit?: number;
}

export interface ContentIndexSearchOptions extends ContentIndexBaseFilters {
  query: string;
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

export interface ContentIndexFacetCount {
  value: string;
  count: number;
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

function normalizeSearchTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).map((term) => term.trim()).filter((term) => term.length > 0))];
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
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

function buildWhereClause(filters: ContentIndexBaseFilters): { sql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.collection) {
    clauses.push('collection = ?');
    values.push(filters.collection);
  }

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
    clauses.push(`((collection != 'sessions' AND collection NOT LIKE 'campaign%') OR COALESCE(visibility, 'gm') = 'public')`);
  }

  return {
    sql: clauses.join(' AND '),
    values,
  };
}

function buildSearchClause(query: string): { sql: string; values: unknown[] } {
  const searchTerms = normalizeSearchTerms(query);
  if (searchTerms.length === 0) {
    return {
      sql: '',
      values: [],
    };
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  for (const term of searchTerms) {
    const likeValue = `%${escapeLikePattern(term)}%`;
    clauses.push(`(
      LOWER(title) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(summary, '')) LIKE ? ESCAPE '\\'
      OR LOWER(slug) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(type, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(subtype, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM json_each(content_index.tags_json) AS search_tag
        WHERE LOWER(CAST(search_tag.value AS TEXT)) LIKE ? ESCAPE '\\'
      )
    )`);
    values.push(likeValue, likeValue, likeValue, likeValue, likeValue, likeValue);
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

  async listPreviewContent(options: ContentIndexPreviewOptions): Promise<ContentIndexRow[]> {
    const limit = normalizePageSize(options.limit ?? 3);
    const where = buildWhereClause(options);
    const query = `
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
      ORDER BY updated_at DESC, slug ASC
      LIMIT ?
    `;
    const result = await this.db.prepare(query).bind(...where.values, limit).all<ContentIndexRowRecord>();
    return result.results.map(toContentIndexRow);
  }

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
      ORDER BY updated_at DESC, slug ASC
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

  async searchContent(options: ContentIndexSearchOptions): Promise<ContentIndexListResult> {
    const requestedPage = normalizePage(options.page);
    const pageSize = normalizePageSize(options.pageSize);
    const where = buildWhereClause(options);
    const search = buildSearchClause(options.query);
    const combinedSql = [where.sql, search.sql].filter((clause) => clause.length > 0).join(' AND ');
    const combinedValues = [...where.values, ...search.values];

    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM content_index
      WHERE ${combinedSql}
    `;
    const countRow = await this.db.prepare(countQuery).bind(...combinedValues).first<CountRow>();
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
      WHERE ${combinedSql}
      ORDER BY updated_at DESC, slug ASC
      LIMIT ? OFFSET ?
    `;
    const result = await this.db
      .prepare(listQuery)
      .bind(...combinedValues, pageSize, offset)
      .all<ContentIndexRowRecord>();

    return {
      items: result.results.map(toContentIndexRow),
      pagination,
    };
  }

  async listTypeCounts(filters: ContentIndexFilters): Promise<ContentIndexFacetCount[]> {
    return this.listFacetCounts('type', filters);
  }

  async listSubtypeCounts(filters: ContentIndexFilters): Promise<ContentIndexFacetCount[]> {
    return this.listFacetCounts('subtype', filters);
  }

  async listTagCounts(filters: ContentIndexFilters): Promise<ContentIndexFacetCount[]> {
    return this.listFacetCounts('tag', filters);
  }

  async listTags(filters: ContentIndexFilters): Promise<string[]> {
    const facets = await this.listTagCounts(filters);
    return facets.map((facet) => facet.value);
  }

  private async listFacetCounts(
    facet: 'type' | 'subtype' | 'tag',
    filters: ContentIndexFilters,
  ): Promise<ContentIndexFacetCount[]> {
    const where = buildWhereClause(filters);
    const query =
      facet === 'tag'
        ? `
            SELECT tag.value AS value, COUNT(DISTINCT content_index.id) AS total_count
            FROM content_index, json_each(content_index.tags_json) AS tag
            WHERE ${where.sql}
              AND tag.value IS NOT NULL
              AND tag.value <> ''
            GROUP BY tag.value
            ORDER BY tag.value ASC
          `
        : `
            SELECT ${facet} AS value, COUNT(*) AS total_count
            FROM content_index
            WHERE ${where.sql}
              AND ${facet} IS NOT NULL
              AND ${facet} <> ''
            GROUP BY ${facet}
            ORDER BY ${facet} ASC
          `;
    const result = await this.db.prepare(query).bind(...where.values).all<FacetRow>();
    return result.results
      .filter((row): row is { value: string; total_count: number | string } => typeof row.value === 'string' && row.value.length > 0)
      .map((row) => ({
        value: row.value,
        count: Number(row.total_count ?? 0),
      }));
  }
}

export function createContentIndexRepoFromLocals(locals: unknown): ContentIndexRepo {
  return new ContentIndexRepo(getD1BindingFromLocals(locals));
}
