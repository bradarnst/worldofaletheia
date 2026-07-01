import { getCloudflareRuntimeEnv } from '@utils/cloudflare-env';

const DEFAULT_CAMPAIGN_NOTES_API_BASE = 'https://admin.worldofaletheia.com';

export type CampaignNoteType = 'session-note' | 'campaign-note' | 'gm-note' | 'recap' | 'downtime-note';
export type CampaignNoteVisibility = 'public' | 'campaignMembers';
export type CampaignNoteSourceKind = 'runtimeEditor' | 'r2Sync' | 'mixed';
export type CampaignNoteLastWriteLane = 'runtime' | 'r2Sync' | null;
export type CampaignNoteSyncState = 'indexed' | 'missing' | 'validation_error';
export type CampaignNoteArchivedReason = 'manual' | 'r2_missing';

export interface CampaignNoteMetadata {
  documentId: string;
  campaignSlug: string;
  noteType: CampaignNoteType;
  title: string;
  visibility: CampaignNoteVisibility;
  authorUserIds: string[];
  sourcePath: string;
  sessionSlug: string | null;
  sessionDate: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archivedAt: string | null;
  archivedReason: CampaignNoteArchivedReason | null;
  metadataVersion: number;
  currentRevisionId: string | null;
  currentContentHash: string | null;
  currentR2Etag: string | null;
  currentR2Version?: string | null;
  sourceKind: CampaignNoteSourceKind;
  lastWriteLane: CampaignNoteLastWriteLane;
  lastScannedAt?: string | null;
  syncState?: CampaignNoteSyncState | null;
}

export interface CampaignNotePage {
  campaignSlug: string;
  items: CampaignNoteMetadata[];
  nextCursor: string | null;
}

export interface CampaignNoteDetail extends CampaignNoteMetadata {
  body: string;
}

export interface CampaignNotesErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

export interface CampaignNotesRuntimeActorAssertion {
  actor: string;
  signature: string;
}

export interface ListCampaignNotesParams {
  campaignSlug: string;
  limit?: number;
  cursor?: string;
  noteType?: CampaignNoteType;
  sessionSlug?: string;
  sessionDate?: string;
}

interface FetchCampaignNotesApiOptions {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  assertion?: CampaignNotesRuntimeActorAssertion | null;
  validate: (value: unknown) => boolean;
}

function readEnvBase(): string | undefined {
  const candidate = import.meta.env?.WOA_ADMIN_API_BASE;
  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim().replace(/\/+$/, '');
  return trimmed === '' ? undefined : trimmed;
}

async function getCampaignNotesApiBase(): Promise<string> {
  const runtimeEnv = await getCloudflareRuntimeEnv();
  const runtimeBase = runtimeEnv?.WOA_ADMIN_API_BASE;
  if (typeof runtimeBase === 'string' && runtimeBase.trim()) {
    return runtimeBase.trim().replace(/\/+$/, '');
  }

  return readEnvBase() ?? DEFAULT_CAMPAIGN_NOTES_API_BASE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isCampaignNoteType(value: unknown): value is CampaignNoteType {
  return value === 'session-note' || value === 'campaign-note' || value === 'gm-note' || value === 'recap' || value === 'downtime-note';
}

function isCampaignNoteVisibility(value: unknown): value is CampaignNoteVisibility {
  return value === 'public' || value === 'campaignMembers';
}

function isSourceKind(value: unknown): value is CampaignNoteSourceKind {
  return value === 'runtimeEditor' || value === 'r2Sync' || value === 'mixed';
}

function isLastWriteLane(value: unknown): value is CampaignNoteLastWriteLane {
  return value === null || value === 'runtime' || value === 'r2Sync';
}

function isArchivedReason(value: unknown): value is CampaignNoteArchivedReason | null {
  return value === null || value === 'manual' || value === 'r2_missing';
}

function isCampaignNoteMetadata(value: unknown): value is CampaignNoteMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.documentId)
    && isString(value.campaignSlug)
    && isCampaignNoteType(value.noteType)
    && isString(value.title)
    && isCampaignNoteVisibility(value.visibility)
    && isStringArray(value.authorUserIds)
    && isString(value.sourcePath)
    && isNullableString(value.sessionSlug)
    && isNullableString(value.sessionDate)
    && isString(value.createdAt)
    && isString(value.updatedAt)
    && typeof value.archived === 'boolean'
    && (value.archivedAt === undefined || isNullableString(value.archivedAt))
    && (value.archivedReason === undefined || isArchivedReason(value.archivedReason))
    && isFiniteNumber(value.metadataVersion)
    && isNullableString(value.currentRevisionId)
    && isNullableString(value.currentContentHash)
    && isNullableString(value.currentR2Etag)
    && (value.currentR2Version === undefined || isNullableString(value.currentR2Version))
    && isSourceKind(value.sourceKind)
    && isLastWriteLane(value.lastWriteLane)
    && (value.lastScannedAt === undefined || isNullableString(value.lastScannedAt));
}

function isCampaignNotePage(value: unknown): value is CampaignNotePage {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.campaignSlug)
    && Array.isArray(value.items)
    && value.items.every(isCampaignNoteMetadata)
    && isNullableString(value.nextCursor);
}

function isCampaignNoteDetail(value: unknown): value is CampaignNoteDetail {
  return isCampaignNoteMetadata(value) && isString(value.body);
}

function isErrorResponse(value: unknown): value is CampaignNotesErrorResponse {
  return isRecord(value) && isString(value.error) && isString(value.message);
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType === 'text/json' || mediaType.endsWith('+json');
}

function buildUrl(base: string, path: string, query: FetchCampaignNotesApiOptions['query'] = {}): URL {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

export class CampaignNotesApiError extends Error {
  status: number;
  error: string;
  requestId: string | null;
  retryAfter: string | null;

  constructor(input: { status: number; error: string; message: string; requestId?: string | null; retryAfter?: string | null; cause?: unknown }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'CampaignNotesApiError';
    this.status = input.status;
    this.error = input.error;
    this.requestId = input.requestId ?? null;
    this.retryAfter = input.retryAfter ?? null;
  }
}

async function parseResponseJson(response: Response): Promise<unknown> {
  if (!isJsonContentType(response.headers.get('content-type'))) {
    throw new CampaignNotesApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Campaign Notes are temporarily unavailable.',
      retryAfter: response.headers.get('Retry-After'),
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new CampaignNotesApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Campaign Notes are temporarily unavailable.',
      retryAfter: response.headers.get('Retry-After'),
      cause,
    });
  }
}

async function fetchCampaignNotesApi<T>(options: FetchCampaignNotesApiOptions): Promise<T> {
  const base = await getCampaignNotesApiBase();
  const url = buildUrl(base, options.path, options.query);
  const headers = new Headers({ Accept: 'application/json' });
  if (options.assertion) {
    headers.set('x-woa-runtime-actor', options.assertion.actor);
    headers.set('x-woa-runtime-signature', options.assertion.signature);
  }

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (cause) {
    throw new CampaignNotesApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Campaign Notes are temporarily unavailable.',
      cause,
    });
  }

  const retryAfter = response.headers.get('Retry-After');
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    if (isErrorResponse(payload)) {
      throw new CampaignNotesApiError({
        status: response.status,
        error: payload.error,
        message: payload.message,
        requestId: payload.requestId,
        retryAfter,
      });
    }

    throw new CampaignNotesApiError({
      status: response.status,
      error: response.status >= 500 ? 'service_unavailable' : 'unexpected_error',
      message: `Campaign Notes API request failed with status ${response.status}.`,
      retryAfter,
    });
  }

  if (!options.validate(payload)) {
    throw new CampaignNotesApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Campaign Notes returned an unexpected response shape.',
      retryAfter,
    });
  }

  return payload as T;
}

export function isCampaignNotesApiError(error: unknown): error is CampaignNotesApiError {
  return error instanceof CampaignNotesApiError;
}

export function normalizeCampaignNoteType(value: string | null): CampaignNoteType | undefined {
  return isCampaignNoteType(value) ? value : undefined;
}

export async function listCampaignNotes(params: ListCampaignNotesParams, assertion?: CampaignNotesRuntimeActorAssertion | null): Promise<CampaignNotePage> {
  return fetchCampaignNotesApi<CampaignNotePage>({
    path: `/api/v1/campaigns/${encodeURIComponent(params.campaignSlug)}/notes/documents`,
    query: {
      limit: params.limit,
      cursor: params.cursor,
      noteType: params.noteType,
      sessionSlug: params.sessionSlug,
      sessionDate: params.sessionDate,
    },
    assertion,
    validate: isCampaignNotePage,
  });
}

export async function getCampaignNote(campaignSlug: string, documentId: string, assertion?: CampaignNotesRuntimeActorAssertion | null): Promise<CampaignNoteDetail> {
  return fetchCampaignNotesApi<CampaignNoteDetail>({
    path: `/api/v1/campaigns/${encodeURIComponent(campaignSlug)}/notes/documents/${encodeURIComponent(documentId)}`,
    assertion,
    validate: isCampaignNoteDetail,
  });
}
