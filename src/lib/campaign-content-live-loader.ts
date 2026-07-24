import type { LiveDataEntry } from 'astro';
import type { LiveLoader } from 'astro/loaders';
import {
  createCampaignContentSourceClient,
  resolveCampaignContentSourceConfig,
  type CampaignContentItemDetail,
  type CampaignContentItemSummary,
  type CampaignContentListOptions,
  type CampaignContentSourceActor,
  type CampaignContentSourceClient,
  type CampaignContentSourceFailure,
} from '~/lib/campaign-content-source-boundary';
import { type ContentVisibility } from '~/lib/campaign-gate-policy';
import { getCloudflareRuntimeEnv } from '~/utils/cloudflare-env';

export type CampaignContentCollectionKey = 'pages' | 'notes';

export interface CampaignContentLiveAccessScope {
  allowedVisibilities: readonly ContentVisibility[];
  actor: CampaignContentSourceActor;
}

export interface CampaignContentLiveCollectionFilter {
  campaignSlug: string;
  collectionKey: CampaignContentCollectionKey;
  accessScope: CampaignContentLiveAccessScope;
  type?: string;
  subtype?: string;
  tag?: string | string[];
  author?: string | string[];
  contributor?: string | string[];
  title?: string;
  updatedSince?: string;
  limit?: number;
  cursor?: string | null;
}

export interface CampaignContentLiveEntryFilter {
  campaignSlug: string;
  collectionKey: CampaignContentCollectionKey;
  documentId: string;
  accessScope: CampaignContentLiveAccessScope;
}

export interface CampaignContentLiveEntryData {
  collection: 'campaignContent';
  campaign: string;
  campaignSlug: string;
  collectionKey: CampaignContentCollectionKey;
  documentId: string;
  title: string;
  visibility: ContentVisibility;
  updatedAt: string | null;
  type: string;
  subtype?: string;
  excerpt?: string;
  tags: string[];
  authors: string[];
  contributors: string[];
  sourceMarkdown?: string;
}

export type CampaignContentLiveLoaderErrorCode = 'invalid_filter' | 'source_unavailable';

export class CampaignContentLiveLoaderError extends Error {
  readonly code: CampaignContentLiveLoaderErrorCode;
  readonly sourceFailure?: CampaignContentSourceFailure;

  constructor(message: string, input: { code: CampaignContentLiveLoaderErrorCode; sourceFailure?: CampaignContentSourceFailure }) {
    super(message);
    this.name = 'CampaignContentLiveLoaderError';
    this.code = input.code;
    this.sourceFailure = input.sourceFailure;
  }
}

interface CreateCampaignContentLiveLoaderOptions {
  sourceClient?: CampaignContentSourceClient;
  createSourceClient?: () => CampaignContentSourceClient | Promise<CampaignContentSourceClient>;
  renderMarkdown?: (markdown: string) => string;
}

type EnvLike = Record<string, string | undefined>;

const supportedCollectionKeys = ['pages', 'notes'] as const satisfies CampaignContentCollectionKey[];
const defaultTypeByCollectionKey: Record<CampaignContentCollectionKey, string> = {
  pages: 'page',
  notes: 'note',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContentVisibility(value: unknown): value is ContentVisibility {
  return value === 'public' || value === 'campaignMembers' || value === 'gm';
}

function isCampaignContentCollectionKey(value: unknown): value is CampaignContentCollectionKey {
  return supportedCollectionKeys.includes(value as CampaignContentCollectionKey);
}

function getRequiredTrimmedString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CampaignContentLiveLoaderError(`Campaign Content live loader requires ${field}.`, { code: 'invalid_filter' });
  }

  return value.trim();
}

function getOptionalTrimmedString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new CampaignContentLiveLoaderError(`Campaign Content live loader ${field} filter must be a string.`, { code: 'invalid_filter' });
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getOptionalStringOrStringArray(value: unknown, field: string): string | string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return getOptionalTrimmedString(value, field);
  }

  if (!Array.isArray(value)) {
    throw new CampaignContentLiveLoaderError(`Campaign Content live loader ${field} filter must be a string or string array.`, {
      code: 'invalid_filter',
    });
  }

  const values = value.map((item) => getRequiredTrimmedString(item, field));
  return values.length > 0 ? values : undefined;
}

function normalizeOptionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new CampaignContentLiveLoaderError('Campaign Content live loader limit filter must be a positive integer.', {
      code: 'invalid_filter',
    });
  }

  return value;
}

function validateDocumentId(documentId: string): void {
  if (documentId.includes('/')) {
    throw new CampaignContentLiveLoaderError('Campaign Content document IDs must be one path segment in V1.', { code: 'invalid_filter' });
  }
}

function normalizeCollectionKey(value: unknown): CampaignContentCollectionKey {
  if (!isCampaignContentCollectionKey(value)) {
    throw new CampaignContentLiveLoaderError('Campaign Content live loader collectionKey must be pages or notes.', { code: 'invalid_filter' });
  }

  return value;
}

function normalizeActor(value: unknown): CampaignContentSourceActor {
  if (!isRecord(value) || (value.kind !== 'anonymous' && value.kind !== 'authenticated')) {
    throw new CampaignContentLiveLoaderError('Campaign Content live loader accessScope.actor is required.', { code: 'invalid_filter' });
  }

  if (value.kind === 'anonymous') {
    return { kind: 'anonymous' };
  }

  return {
    kind: 'authenticated',
    userId: getRequiredTrimmedString(value.userId, 'accessScope.actor.userId'),
    traceId: getRequiredTrimmedString(value.traceId, 'accessScope.actor.traceId'),
  };
}

function normalizeAccessScope(value: unknown): CampaignContentLiveAccessScope {
  if (!isRecord(value)) {
    throw new CampaignContentLiveLoaderError('Campaign Content live loader accessScope is required.', { code: 'invalid_filter' });
  }

  if (!Array.isArray(value.allowedVisibilities) || value.allowedVisibilities.length === 0) {
    throw new CampaignContentLiveLoaderError('Campaign Content live loader accessScope.allowedVisibilities is required.', {
      code: 'invalid_filter',
    });
  }

  const allowedVisibilities = value.allowedVisibilities.map((visibility) => {
    if (!isContentVisibility(visibility)) {
      throw new CampaignContentLiveLoaderError('Campaign Content live loader accessScope.allowedVisibilities is invalid.', {
        code: 'invalid_filter',
      });
    }
    return visibility;
  });

  return {
    allowedVisibilities,
    actor: normalizeActor(value.actor),
  };
}

function normalizeCollectionFilter(filter: unknown): CampaignContentLiveCollectionFilter {
  if (!isRecord(filter)) {
    throw new CampaignContentLiveLoaderError('Campaign Content live collection queries require a structured filter.', {
      code: 'invalid_filter',
    });
  }

  return {
    campaignSlug: getRequiredTrimmedString(filter.campaignSlug, 'campaignSlug'),
    collectionKey: normalizeCollectionKey(filter.collectionKey),
    accessScope: normalizeAccessScope(filter.accessScope),
    type: getOptionalTrimmedString(filter.type, 'type'),
    subtype: getOptionalTrimmedString(filter.subtype, 'subtype'),
    tag: getOptionalStringOrStringArray(filter.tag, 'tag'),
    author: getOptionalStringOrStringArray(filter.author, 'author'),
    contributor: getOptionalStringOrStringArray(filter.contributor, 'contributor'),
    title: getOptionalTrimmedString(filter.title, 'title'),
    updatedSince: getOptionalTrimmedString(filter.updatedSince, 'updatedSince'),
    limit: normalizeOptionalLimit(filter.limit),
    cursor: getOptionalTrimmedString(filter.cursor, 'cursor') ?? null,
  };
}

function normalizeEntryFilter(filter: unknown): CampaignContentLiveEntryFilter {
  if (!isRecord(filter) || 'id' in filter) {
    throw new CampaignContentLiveLoaderError('Campaign Content live entry queries require structured campaign, collection, and document filters.', {
      code: 'invalid_filter',
    });
  }

  const documentId = getRequiredTrimmedString(filter.documentId, 'documentId');
  validateDocumentId(documentId);

  return {
    campaignSlug: getRequiredTrimmedString(filter.campaignSlug, 'campaignSlug'),
    collectionKey: normalizeCollectionKey(filter.collectionKey),
    documentId,
    accessScope: normalizeAccessScope(filter.accessScope),
  };
}

function getStringValue(env: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = env?.[key];
  return typeof value === 'string' ? value : undefined;
}

async function resolveRuntimeSourceEnv(): Promise<EnvLike> {
  const runtimeEnv = await getCloudflareRuntimeEnv();
  return {
    CAMPAIGN_CONTENT_SOURCE_BASE_URL:
      getStringValue(runtimeEnv, 'CAMPAIGN_CONTENT_SOURCE_BASE_URL') ?? import.meta.env.CAMPAIGN_CONTENT_SOURCE_BASE_URL,
    CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET:
      getStringValue(runtimeEnv, 'CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET') ?? import.meta.env.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET,
    CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE:
      getStringValue(runtimeEnv, 'CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE') ?? import.meta.env.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE,
  };
}

async function createDefaultSourceClient(): Promise<CampaignContentSourceClient> {
  return createCampaignContentSourceClient({ config: resolveCampaignContentSourceConfig(await resolveRuntimeSourceEnv()) });
}

function getOptionalStringArray(raw: Record<string, unknown>, field: string): string[] {
  const value = raw[field];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function getOptionalRawString(raw: Record<string, unknown>, field: string): string | undefined {
  const value = raw[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeEntryData(item: CampaignContentItemSummary | CampaignContentItemDetail): CampaignContentLiveEntryData {
  const collectionKey = normalizeCollectionKey(item.collectionKey);

  return {
    collection: 'campaignContent',
    campaign: item.campaignSlug,
    campaignSlug: item.campaignSlug,
    collectionKey,
    documentId: item.documentId,
    title: item.title,
    visibility: item.visibility,
    updatedAt: item.updatedAt,
    type: getOptionalRawString(item.raw, 'type') ?? defaultTypeByCollectionKey[collectionKey],
    subtype: getOptionalRawString(item.raw, 'subtype'),
    excerpt: getOptionalRawString(item.raw, 'excerpt'),
    tags: getOptionalStringArray(item.raw, 'tags'),
    authors: getOptionalStringArray(item.raw, 'authors'),
    contributors: getOptionalStringArray(item.raw, 'contributors'),
    ...('body' in item ? { sourceMarkdown: item.body } : {}),
  };
}

export function normalizeCampaignContentEntryId(input: {
  campaignSlug: string;
  collectionKey: CampaignContentCollectionKey;
  documentId: string;
}): string {
  const campaignSlug = getRequiredTrimmedString(input.campaignSlug, 'campaignSlug');
  const collectionKey = normalizeCollectionKey(input.collectionKey);
  const documentId = getRequiredTrimmedString(input.documentId, 'documentId');
  validateDocumentId(documentId);
  return `${campaignSlug}/${collectionKey}/${documentId}`;
}

function parseUpdatedAt(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function createCacheHint(input: { campaignSlug: string; collectionKey: CampaignContentCollectionKey; updatedAt?: string | null }) {
  const lastModified = parseUpdatedAt(input.updatedAt ?? null);
  return {
    tags: [`campaign-content:${input.campaignSlug}`, `campaign-content:${input.campaignSlug}:${input.collectionKey}`],
    ...(lastModified ? { lastModified } : {}),
  };
}

function toLiveEntry(item: CampaignContentItemSummary): LiveDataEntry<CampaignContentLiveEntryData> {
  const data = normalizeEntryData(item);
  return {
    id: normalizeCampaignContentEntryId(data),
    data,
    cacheHint: createCacheHint(data),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return slug || 'section';
}

function renderCampaignContentMarkdown(markdown: string): string {
  return markdown
    .trim()
    .split(/\n{2,}/g)
    .map((block) => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(block.trim());
      if (heading) {
        const level = heading[1]?.length ?? 1;
        const text = heading[2] ?? '';
        return `<h${level} id="${slugifyHeading(text)}">${escapeHtml(text)}</h${level}>`;
      }

      return `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function toRenderableLiveEntry(input: {
  item: CampaignContentItemDetail;
  renderMarkdown: (markdown: string) => string;
}): LiveDataEntry<CampaignContentLiveEntryData> {
  const entry = toLiveEntry(input.item);
  return {
    ...entry,
    rendered: {
      html: input.renderMarkdown(input.item.body),
    },
  };
}

function createSourceFailureError(failure: CampaignContentSourceFailure): CampaignContentLiveLoaderError {
  return new CampaignContentLiveLoaderError(`Campaign Content source read failed: ${failure.safeMessage}`, {
    code: 'source_unavailable',
    sourceFailure: failure,
  });
}

function toSourceAccessScope(accessScope: CampaignContentLiveAccessScope) {
  return {
    allowedVisibilities: [...accessScope.allowedVisibilities],
    actor: accessScope.actor,
  };
}

function toListOptions(filter: CampaignContentLiveCollectionFilter): CampaignContentListOptions {
  return {
    campaignSlug: filter.campaignSlug,
    collectionKey: filter.collectionKey,
    ...toSourceAccessScope(filter.accessScope),
    type: filter.type,
    subtype: filter.subtype,
    tag: filter.tag,
    author: filter.author,
    contributor: filter.contributor,
    title: filter.title,
    updatedSince: filter.updatedSince,
    limit: filter.limit,
    cursor: filter.cursor,
  };
}

export function createCampaignContentLiveLoader(
  options: CreateCampaignContentLiveLoaderOptions = {},
): LiveLoader<CampaignContentLiveEntryData, CampaignContentLiveEntryFilter, CampaignContentLiveCollectionFilter, CampaignContentLiveLoaderError> {
  const renderMarkdown = options.renderMarkdown ?? renderCampaignContentMarkdown;
  const getSourceClient = async () => options.sourceClient ?? options.createSourceClient?.() ?? createDefaultSourceClient();

  return {
    name: 'campaign-content-live-loader',
    async loadCollection({ filter }) {
      try {
        const normalizedFilter = normalizeCollectionFilter(filter);
        const result = await (await getSourceClient()).listCampaignContent(toListOptions(normalizedFilter));
        if (!result.ok) {
          return { error: createSourceFailureError(result) };
        }

        return {
          entries: result.value.items.map(toLiveEntry),
          cacheHint: createCacheHint({ campaignSlug: normalizedFilter.campaignSlug, collectionKey: normalizedFilter.collectionKey }),
        };
      } catch (error) {
        return {
          error:
            error instanceof CampaignContentLiveLoaderError
              ? error
              : new CampaignContentLiveLoaderError('Campaign Content live collection query failed.', { code: 'source_unavailable' }),
        };
      }
    },
    async loadEntry({ filter }) {
      try {
        const normalizedFilter = normalizeEntryFilter(filter);
        const result = await (await getSourceClient()).getCampaignContentItem({
          campaignSlug: normalizedFilter.campaignSlug,
          collectionKey: normalizedFilter.collectionKey,
          documentId: normalizedFilter.documentId,
          ...toSourceAccessScope(normalizedFilter.accessScope),
        });
        if (!result.ok) {
          return result.reason === 'notFoundOrNotReadable' ? undefined : { error: createSourceFailureError(result) };
        }

        return toRenderableLiveEntry({ item: result.value, renderMarkdown });
      } catch (error) {
        return {
          error:
            error instanceof CampaignContentLiveLoaderError
              ? error
              : new CampaignContentLiveLoaderError('Campaign Content live entry query failed.', { code: 'source_unavailable' }),
        };
      }
    },
  };
}
