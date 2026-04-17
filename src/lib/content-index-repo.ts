import { type ContentEnvironment, getIncludedStatuses } from '~/utils/content-filter';
import { type D1DatabaseLike, getD1BindingFromLocals } from './d1';

type ContentIndexVisibility = 'public' | 'campaignMembers' | 'gm';

export interface ContentIndexCampaignVisibilityAccess {
  memberCampaignSlugs?: string[];
  gmCampaignSlugs?: string[];
}

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
  r2_key: string;
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
  r2Key: string;
  sourceEtag: string;
  sourceLastModified: string;
  indexedAt: string;
}

interface ContentIndexBaseFilters {
  collection?: string;
  type?: string;
  subtype?: string;
  tags?: string[];
  query?: string;
  environment?: ContentEnvironment;
  visibilityScope?: 'public';
  visibilityAccess?: ContentIndexCampaignVisibilityAccess;
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
  searchMode?: 'fts' | 'metadata';
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

function normalizeCampaignSlugs(slugs: string[] | undefined): string[] {
  if (!slugs) {
    return [];
  }

  return [...new Set(slugs.map((slug) => slug.trim()).filter((slug) => slug.length > 0))].sort((left, right) =>
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
    r2Key: record.r2_key,
    sourceEtag: record.source_etag,
    sourceLastModified: record.source_last_modified,
    indexedAt: record.indexed_at,
  };
}

function buildVisibilityClause(filters: ContentIndexBaseFilters): { sql: string; values: unknown[] } {
  const gmCampaignSlugs = normalizeCampaignSlugs(filters.visibilityAccess?.gmCampaignSlugs);
  const memberCampaignSlugs = normalizeCampaignSlugs([
    ...(filters.visibilityAccess?.memberCampaignSlugs ?? []),
    ...gmCampaignSlugs,
  ]);

  if (memberCampaignSlugs.length === 0 && gmCampaignSlugs.length === 0) {
    return {
      sql: "((content_index.collection != 'sessions' AND content_index.collection NOT LIKE 'campaign%') OR COALESCE(content_index.visibility, 'gm') = 'public')",
      values: [],
    };
  }

  const campaignClauses = ["COALESCE(content_index.visibility, 'gm') = 'public'"];
  const values: unknown[] = [];

  if (memberCampaignSlugs.length > 0) {
    campaignClauses.push(
      `(COALESCE(content_index.visibility, 'gm') = 'campaignMembers' AND content_index.campaign_slug IN (${memberCampaignSlugs.map(() => '?').join(', ')}))`,
    );
    values.push(...memberCampaignSlugs);
  }

  if (gmCampaignSlugs.length > 0) {
    campaignClauses.push(
      `(COALESCE(content_index.visibility, 'gm') = 'gm' AND content_index.campaign_slug IN (${gmCampaignSlugs.map(() => '?').join(', ')}))`,
    );
    values.push(...gmCampaignSlugs);
  }

  return {
    sql: `((content_index.collection != 'sessions' AND content_index.collection NOT LIKE 'campaign%') OR (${campaignClauses.join(' OR ')}))`,
    values,
  };
}

function buildWhereClause(filters: ContentIndexBaseFilters): { sql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.collection) {
    clauses.push('content_index.collection = ?');
    values.push(filters.collection);
  }

  const statuses = getIncludedStatuses(filters.environment ?? 'production');

  clauses.push(`content_index.status IN (${statuses.map(() => '?').join(', ')})`);
  values.push(...statuses);

  if (filters.type) {
    clauses.push('content_index.type = ?');
    values.push(filters.type);
  }

  if (filters.subtype) {
    clauses.push('content_index.subtype = ?');
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

  const visibility = buildVisibilityClause(filters);
  clauses.push(visibility.sql);
  values.push(...visibility.values);

  return {
    sql: clauses.join(' AND '),
    values,
  };
}

function buildMetadataFilterClause(filters: ContentIndexBaseFilters): { sql: string; values: unknown[] } {
  const where = buildWhereClause(filters);
  const search = buildMetadataSearchClause(filters.query ?? '');

  return {
    sql: [where.sql, search.sql].filter((clause) => clause.length > 0).join(' AND '),
    values: [...where.values, ...search.values],
  };
}

function buildMetadataSearchClause(query: string): { sql: string; values: unknown[] } {
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
      LOWER(content_index.title) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(content_index.summary, '')) LIKE ? ESCAPE '\\'
      OR LOWER(content_index.slug) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(content_index.type, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(content_index.subtype, '')) LIKE ? ESCAPE '\\'
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

function buildFtsMatchQuery(query: string): string {
  const terms = normalizeSearchTerms(query);
  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(' AND ');
}

function buildFtsFilterClause(filters: ContentIndexBaseFilters): { sql: string; values: unknown[] } {
  const where = buildWhereClause(filters);
  const ftsQuery = buildFtsMatchQuery(filters.query ?? '');

  if (!ftsQuery) {
    return {
      sql: where.sql,
      values: where.values,
    };
  }

  return {
    sql: [where.sql, 'content_search_fts MATCH ?'].join(' AND '),
    values: [...where.values, ftsQuery],
  };
}

function isFtsUnavailableError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();

  return (
    message.includes('no such module: fts5') ||
    (message.includes('no such table') && message.includes('content_search')) ||
    (message.includes('no such table') && message.includes('content_search_fts'))
  );
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
    const where = buildMetadataFilterClause(options);
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
        r2_key,
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
    const where = buildMetadataFilterClause(options);

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
        r2_key,
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
    const searchMode = options.searchMode ?? 'fts';

    if (searchMode === 'metadata') {
      return this.searchMetadataContent(options, requestedPage, pageSize);
    }

    try {
      return await this.searchFtsContent(options, requestedPage, pageSize);
    } catch (error) {
      if (isFtsUnavailableError(error)) {
        return this.searchMetadataContent(options, requestedPage, pageSize);
      }

      throw error;
    }
  }

  private async searchFtsContent(
    options: ContentIndexSearchOptions,
    requestedPage: number,
    pageSize: number,
  ): Promise<ContentIndexListResult> {

    const filters = buildFtsFilterClause(options);

    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM content_index
      INNER JOIN content_search
        ON content_search.collection = content_index.collection
       AND content_search.id = content_index.id
      INNER JOIN content_search_fts
        ON content_search_fts.rowid = content_search.rowid
      WHERE ${filters.sql}
    `;
    const countRow = await this.db.prepare(countQuery).bind(...filters.values).first<CountRow>();
    const totalItems = Number(countRow?.total_count ?? 0);
    const pagination = createPagination(totalItems, requestedPage, pageSize);
    const offset = (pagination.page - 1) * pageSize;

    const listQuery = `
      SELECT
        content_index.id,
        content_index.collection,
        content_index.slug,
        content_index.title,
        content_index.type,
        content_index.subtype,
        content_index.tags_json,
        content_index.visibility,
        content_index.campaign_slug,
        content_index.summary,
        content_index.status,
        content_index.author,
        content_index.created_at,
        content_index.updated_at,
        content_index.r2_key,
        content_index.source_etag,
        content_index.source_last_modified,
        content_index.indexed_at
      FROM content_index
      INNER JOIN content_search
        ON content_search.collection = content_index.collection
       AND content_search.id = content_index.id
      INNER JOIN content_search_fts
        ON content_search_fts.rowid = content_search.rowid
      WHERE ${filters.sql}
      ORDER BY content_index.updated_at DESC, content_index.slug ASC
      LIMIT ? OFFSET ?
    `;
    const result = await this.db
      .prepare(listQuery)
      .bind(...filters.values, pageSize, offset)
      .all<ContentIndexRowRecord>();

    return {
      items: result.results.map(toContentIndexRow),
      pagination,
    };
  }

  private async searchMetadataContent(
    options: ContentIndexSearchOptions,
    requestedPage: number,
    pageSize: number,
  ): Promise<ContentIndexListResult> {
    const filters = buildMetadataFilterClause(options);

    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM content_index
      WHERE ${filters.sql}
    `;
    const countRow = await this.db.prepare(countQuery).bind(...filters.values).first<CountRow>();
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
        r2_key,
        source_etag,
        source_last_modified,
        indexed_at
      FROM content_index
      WHERE ${filters.sql}
      ORDER BY content_index.updated_at DESC, content_index.slug ASC
      LIMIT ? OFFSET ?
    `;
    const result = await this.db
      .prepare(listQuery)
      .bind(...filters.values, pageSize, offset)
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
    const where = buildMetadataFilterClause(filters);
    // Qualify column references to avoid ambiguity in JOINs
    const qualify = (col: string) => `content_index.${col}`;
    const query =
      facet === 'tag'
        ? `
            SELECT tag.value AS value, COUNT(DISTINCT ${qualify('collection')} || ':' || ${qualify('id')}) AS total_count
            FROM content_index
            INNER JOIN json_each(content_index.tags_json) AS tag
            WHERE ${where.sql}
              AND tag.value IS NOT NULL
              AND tag.value <> ''
            GROUP BY tag.value
            ORDER BY tag.value ASC
          `
        : `
            SELECT ${qualify(facet)} AS value, COUNT(*) AS total_count
            FROM content_index
            WHERE ${where.sql}
              AND ${qualify(facet)} IS NOT NULL
              AND ${qualify(facet)} <> ''
            GROUP BY ${qualify(facet)}
            ORDER BY ${qualify(facet)} ASC
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

export async function createContentIndexRepoFromLocals(locals: unknown): Promise<ContentIndexRepo> {
  const db = await getD1BindingFromLocals(locals);
  return new ContentIndexRepo(db);
}
