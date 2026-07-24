import type { ContentVisibility } from '~/lib/campaign-gate-policy';

export const ASSERTION_EXPIRY_SECONDS = 60;
export const CAMPAIGN_CONTENT_READ_OPERATION = 'campaignContent:read';
export const DEFAULT_ASSERTION_AUDIENCE = 'woa-admin:campaign-content-source:v1';
export const RUNTIME_ASSERTION_HEADER = 'x-woa-runtime-assertion';
export const RUNTIME_ASSERTION_SIGNATURE_HEADER = 'x-woa-runtime-signature';

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export interface CampaignContentSourceConfig {
  baseUrl: string;
  assertionSecret: string;
  assertionAudience?: string;
}

export type CampaignContentSourceActor =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

export interface CampaignContentRuntimeAssertionPayload {
  aud: string;
  iat: number;
  exp: number;
  campaignSlug: string;
  operation: typeof CAMPAIGN_CONTENT_READ_OPERATION;
  allowedVisibilities: ContentVisibility[];
  subject: {
    kind: CampaignContentSourceActor['kind'];
    trace: string;
  };
}

export interface RuntimeAssertionHeaders {
  [RUNTIME_ASSERTION_HEADER]: string;
  [RUNTIME_ASSERTION_SIGNATURE_HEADER]: string;
}

export interface CampaignContentSourceRequestScope {
  campaignSlug: string;
  allowedVisibilities: ContentVisibility[];
  actor: CampaignContentSourceActor;
}

export interface CampaignContentListOptions extends CampaignContentSourceRequestScope {
  collectionKey?: string;
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

export interface CampaignContentDetailOptions extends CampaignContentSourceRequestScope {
  collectionKey: string;
  documentId: string;
}

export interface CampaignContentItemSummary {
  campaignSlug: string;
  collectionKey: string;
  documentId: string;
  title: string;
  visibility: ContentVisibility;
  updatedAt: string | null;
  raw: Record<string, unknown>;
}

export interface CampaignContentItemDetail extends CampaignContentItemSummary {
  body: string;
}

export interface CampaignContentListPage {
  campaignSlug: string;
  items: CampaignContentItemSummary[];
  nextCursor: string | null;
}

export type CampaignContentSourceFailureReason =
  | 'notFoundOrNotReadable'
  | 'integrationRejected'
  | 'invalidRequest'
  | 'rateLimited'
  | 'sourceUnavailable'
  | 'networkFailure'
  | 'validationFailure';

export interface CampaignContentSourceFailure {
  ok: false;
  reason: CampaignContentSourceFailureReason;
  mainSiteStatus: 404 | 503;
  retryable: boolean;
  safeMessage: 'Campaign content not found.' | 'Campaign content unavailable.';
  sourceStatus?: number;
}

export type CampaignContentSourceResult<T> = { ok: true; value: T } | CampaignContentSourceFailure;

export interface CampaignContentSourceClient {
  listCampaignContent(options: CampaignContentListOptions): Promise<CampaignContentSourceResult<CampaignContentListPage>>;
  getCampaignContentItem(options: CampaignContentDetailOptions): Promise<CampaignContentSourceResult<CampaignContentItemDetail>>;
}

interface CreateCampaignContentSourceClientOptions {
  config: CampaignContentSourceConfig;
  fetch?: FetchLike;
}

function getDefaultEnv(): EnvLike {
  return import.meta.env as EnvLike;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/g, '');
}

function normalizeRequiredConfigValue(value: string | undefined, name: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${name} is required for Campaign Content source reads.`);
  }
  return trimmed;
}

export function resolveCampaignContentSourceConfig(env: EnvLike = getDefaultEnv()): CampaignContentSourceConfig {
  return {
    baseUrl: trimTrailingSlashes(normalizeRequiredConfigValue(env.CAMPAIGN_CONTENT_SOURCE_BASE_URL, 'CAMPAIGN_CONTENT_SOURCE_BASE_URL')),
    assertionSecret: normalizeRequiredConfigValue(
      env.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET,
      'CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET',
    ),
    assertionAudience: env.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE?.trim() || DEFAULT_ASSERTION_AUDIENCE,
  };
}

function ensureCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required to mint Campaign Content runtime assertions.');
  }
  return globalThis.crypto;
}

function toBase64Url(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeJsonPayload(payload: CampaignContentRuntimeAssertionPayload): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

async function signBase64Url(value: string, secret: string): Promise<string> {
  const crypto = ensureCrypto();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function createSubjectTrace(actor: CampaignContentSourceActor, secret: string): Promise<CampaignContentRuntimeAssertionPayload['subject']> {
  if (actor.kind === 'anonymous') {
    return { kind: 'anonymous', trace: 'anonymous' };
  }

  const signature = await signBase64Url(`${actor.userId}:${actor.traceId}`, secret);
  return {
    kind: 'authenticated',
    trace: `auth_${signature.slice(0, 24)}`,
  };
}

export async function createRuntimeAssertionHeaders(input: {
  config: CampaignContentSourceConfig;
  campaignSlug: string;
  allowedVisibilities: ContentVisibility[];
  actor: CampaignContentSourceActor;
  issuedAt?: Date;
}): Promise<RuntimeAssertionHeaders> {
  const issuedAt = Math.floor((input.issuedAt?.getTime() ?? Date.now()) / 1000);
  const assertionSecret = input.config.assertionSecret;
  const payload: CampaignContentRuntimeAssertionPayload = {
    aud: input.config.assertionAudience ?? DEFAULT_ASSERTION_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + ASSERTION_EXPIRY_SECONDS,
    campaignSlug: input.campaignSlug,
    operation: CAMPAIGN_CONTENT_READ_OPERATION,
    allowedVisibilities: [...input.allowedVisibilities],
    subject: await createSubjectTrace(input.actor, assertionSecret),
  };
  const assertion = encodeJsonPayload(payload);

  return {
    [RUNTIME_ASSERTION_HEADER]: assertion,
    [RUNTIME_ASSERTION_SIGNATURE_HEADER]: await signBase64Url(assertion, assertionSecret),
  };
}

export function decodeRuntimeAssertion(assertion: string): CampaignContentRuntimeAssertionPayload {
  const decoded = new TextDecoder().decode(fromBase64Url(assertion));
  const parsed: unknown = JSON.parse(decoded);
  if (!isRuntimeAssertionPayload(parsed)) {
    throw new Error('Runtime assertion did not decode to a valid Campaign Content runtime assertion payload.');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContentVisibility(value: unknown): value is ContentVisibility {
  return value === 'public' || value === 'campaignMembers' || value === 'gm';
}

function isRuntimeAssertionPayload(value: unknown): value is CampaignContentRuntimeAssertionPayload {
  if (!isRecord(value)) {
    return false;
  }

  const subject = value.subject;
  return (
    typeof value.aud === 'string'
    && typeof value.iat === 'number'
    && typeof value.exp === 'number'
    && typeof value.campaignSlug === 'string'
    && value.operation === CAMPAIGN_CONTENT_READ_OPERATION
    && Array.isArray(value.allowedVisibilities)
    && value.allowedVisibilities.every(isContentVisibility)
    && isRecord(subject)
    && (subject.kind === 'anonymous' || subject.kind === 'authenticated')
    && typeof subject.trace === 'string'
  );
}

function getRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Campaign Content source response is missing ${field}.`);
  }
  return value;
}

function getOptionalString(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Campaign Content source response has invalid ${field}.`);
  }
  return value;
}

function assertMatchingField(actual: string, expected: string, field: string): void {
  if (actual !== expected) {
    throw new Error(`Campaign Content source response ${field} did not match the request.`);
  }
}

function validateDocumentId(documentId: string): void {
  if (documentId.includes('/')) {
    throw new Error('Campaign Content document IDs must be one path segment in V1.');
  }
}

function validateSummaryItem(input: {
  item: unknown;
  campaignSlug: string;
  collectionKey?: string;
  allowedVisibilities: ContentVisibility[];
}): CampaignContentItemSummary {
  if (!isRecord(input.item)) {
    throw new Error('Campaign Content source response item must be an object.');
  }

  const itemCampaignSlug = getOptionalString(input.item, 'campaignSlug') ?? input.campaignSlug;
  assertMatchingField(itemCampaignSlug, input.campaignSlug, 'campaignSlug');

  const collectionKey = getRequiredString(input.item, 'collectionKey');
  if (input.collectionKey) {
    assertMatchingField(collectionKey, input.collectionKey, 'collectionKey');
  }

  const documentId = getRequiredString(input.item, 'documentId');
  validateDocumentId(documentId);

  const visibility = input.item.visibility;
  if (!isContentVisibility(visibility) || !input.allowedVisibilities.includes(visibility)) {
    throw new Error('Campaign Content source response returned unreadable or invalid visibility.');
  }

  return {
    campaignSlug: itemCampaignSlug,
    collectionKey,
    documentId,
    title: getRequiredString(input.item, 'title'),
    visibility,
    updatedAt: getOptionalString(input.item, 'updatedAt'),
    raw: input.item,
  };
}

function validateDetailItem(input: {
  item: unknown;
  campaignSlug: string;
  collectionKey: string;
  documentId: string;
  allowedVisibilities: ContentVisibility[];
}): CampaignContentItemDetail {
  const summary = validateSummaryItem(input);
  assertMatchingField(summary.documentId, input.documentId, 'documentId');

  if (!isRecord(input.item)) {
    throw new Error('Campaign Content source detail response item must be an object.');
  }

  const body = input.item.body;
  if (typeof body !== 'string') {
    throw new Error('Campaign Content source detail response is missing body.');
  }

  return {
    ...summary,
    body,
  };
}

function validateListResponse(input: {
  body: unknown;
  campaignSlug: string;
  collectionKey?: string;
  allowedVisibilities: ContentVisibility[];
}): CampaignContentListPage {
  if (!isRecord(input.body)) {
    throw new Error('Campaign Content source list response must be an object.');
  }

  assertMatchingField(getRequiredString(input.body, 'campaignSlug'), input.campaignSlug, 'campaignSlug');

  const items = input.body.items;
  if (!Array.isArray(items)) {
    throw new Error('Campaign Content source list response is missing items.');
  }

  const nextCursor = input.body.nextCursor;
  if (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== 'string') {
    throw new Error('Campaign Content source list response has invalid nextCursor.');
  }

  return {
    campaignSlug: input.campaignSlug,
    items: items.map((item) =>
      validateSummaryItem({
        item,
        campaignSlug: input.campaignSlug,
        collectionKey: input.collectionKey,
        allowedVisibilities: input.allowedVisibilities,
      }),
    ),
    nextCursor: nextCursor ?? null,
  };
}

function validateDetailResponse(input: {
  body: unknown;
  campaignSlug: string;
  collectionKey: string;
  documentId: string;
  allowedVisibilities: ContentVisibility[];
}): CampaignContentItemDetail {
  if (!isRecord(input.body)) {
    throw new Error('Campaign Content source detail response must be an object.');
  }

  assertMatchingField(getRequiredString(input.body, 'campaignSlug'), input.campaignSlug, 'campaignSlug');
  return validateDetailItem({
    item: input.body.item,
    campaignSlug: input.campaignSlug,
    collectionKey: input.collectionKey,
    documentId: input.documentId,
    allowedVisibilities: input.allowedVisibilities,
  });
}

function createFailure(input: {
  reason: CampaignContentSourceFailureReason;
  mainSiteStatus: 404 | 503;
  retryable: boolean;
  sourceStatus?: number;
}): CampaignContentSourceFailure {
  const base = {
    ok: false as const,
    reason: input.reason,
    mainSiteStatus: input.mainSiteStatus,
    retryable: input.retryable,
    safeMessage: input.mainSiteStatus === 404 ? 'Campaign content not found.' as const : 'Campaign content unavailable.' as const,
  };

  return input.sourceStatus === undefined ? base : { ...base, sourceStatus: input.sourceStatus };
}

export function mapCampaignContentSourceFailure(input: { status?: number; reason?: 'networkFailure' | 'validationFailure' }): CampaignContentSourceFailure {
  if (input.reason === 'networkFailure') {
    return createFailure({ reason: 'networkFailure', mainSiteStatus: 503, retryable: true });
  }

  if (input.reason === 'validationFailure') {
    return createFailure({ reason: 'validationFailure', mainSiteStatus: 503, retryable: false });
  }

  switch (input.status) {
    case 404:
      return createFailure({ reason: 'notFoundOrNotReadable', mainSiteStatus: 404, retryable: false, sourceStatus: input.status });
    case 401:
      return createFailure({ reason: 'integrationRejected', mainSiteStatus: 503, retryable: false, sourceStatus: input.status });
    case 400:
      return createFailure({ reason: 'invalidRequest', mainSiteStatus: 503, retryable: false, sourceStatus: input.status });
    case 429:
      return createFailure({ reason: 'rateLimited', mainSiteStatus: 503, retryable: true, sourceStatus: input.status });
    case 503:
      return createFailure({ reason: 'sourceUnavailable', mainSiteStatus: 503, retryable: true, sourceStatus: input.status });
    default:
      return createFailure({ reason: 'sourceUnavailable', mainSiteStatus: 503, retryable: true, sourceStatus: input.status });
  }
}

function appendStringFilter(searchParams: URLSearchParams, key: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    searchParams.set(key, trimmed);
  }
}

function appendRepeatedFilter(searchParams: URLSearchParams, key: string, value: string | string[] | undefined): void {
  if (value === undefined) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const trimmed = item.trim();
    if (trimmed) {
      searchParams.append(key, trimmed);
    }
  }
}

function buildListUrl(config: CampaignContentSourceConfig, options: CampaignContentListOptions): string {
  const url = new URL(
    `/api/v1/campaigns/${encodeURIComponent(options.campaignSlug)}/campaign-content`,
    trimTrailingSlashes(config.baseUrl),
  );
  appendStringFilter(url.searchParams, 'collectionKey', options.collectionKey);
  appendStringFilter(url.searchParams, 'type', options.type);
  appendStringFilter(url.searchParams, 'subtype', options.subtype);
  appendRepeatedFilter(url.searchParams, 'tag', options.tag);
  appendRepeatedFilter(url.searchParams, 'author', options.author);
  appendRepeatedFilter(url.searchParams, 'contributor', options.contributor);
  appendStringFilter(url.searchParams, 'title', options.title);
  appendStringFilter(url.searchParams, 'updatedSince', options.updatedSince);
  if (options.limit !== undefined) {
    url.searchParams.set('limit', String(options.limit));
  }
  appendStringFilter(url.searchParams, 'cursor', options.cursor ?? undefined);
  return url.toString();
}

function buildDetailUrl(config: CampaignContentSourceConfig, options: CampaignContentDetailOptions): string {
  return new URL(
    `/api/v1/campaigns/${encodeURIComponent(options.campaignSlug)}/campaign-content/${encodeURIComponent(options.collectionKey)}/${encodeURIComponent(options.documentId)}`,
    trimTrailingSlashes(config.baseUrl),
  ).toString();
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Campaign Content source response did not contain valid JSON.');
  }
}

export function createCampaignContentSourceClient(options: CreateCampaignContentSourceClientOptions): CampaignContentSourceClient {
  const fetchImpl = options.fetch ?? fetch;
  const config = {
    ...options.config,
    baseUrl: trimTrailingSlashes(options.config.baseUrl),
    assertionAudience: options.config.assertionAudience ?? DEFAULT_ASSERTION_AUDIENCE,
  };

  async function fetchSourceJson<T>(input: {
    url: string;
    scope: CampaignContentSourceRequestScope;
    validate(body: unknown): T;
  }): Promise<CampaignContentSourceResult<T>> {
    let assertionHeaders: RuntimeAssertionHeaders;
    try {
      assertionHeaders = await createRuntimeAssertionHeaders({
        config,
        campaignSlug: input.scope.campaignSlug,
        allowedVisibilities: input.scope.allowedVisibilities,
        actor: input.scope.actor,
      });
    } catch {
      return createFailure({ reason: 'integrationRejected', mainSiteStatus: 503, retryable: false });
    }

    let response: Response;
    try {
      response = await fetchImpl(input.url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...assertionHeaders,
        },
      });
    } catch {
      return mapCampaignContentSourceFailure({ reason: 'networkFailure' });
    }

    if (!response.ok) {
      return mapCampaignContentSourceFailure({ status: response.status });
    }

    try {
      return { ok: true, value: input.validate(await readJsonResponse(response)) };
    } catch {
      return mapCampaignContentSourceFailure({ reason: 'validationFailure' });
    }
  }

  return {
    listCampaignContent(listOptions) {
      return fetchSourceJson({
        url: buildListUrl(config, listOptions),
        scope: listOptions,
        validate: (body) =>
          validateListResponse({
            body,
            campaignSlug: listOptions.campaignSlug,
            collectionKey: listOptions.collectionKey,
            allowedVisibilities: listOptions.allowedVisibilities,
          }),
      });
    },
    getCampaignContentItem(detailOptions) {
      return fetchSourceJson({
        url: buildDetailUrl(config, detailOptions),
        scope: detailOptions,
        validate: (body) =>
          validateDetailResponse({
            body,
            campaignSlug: detailOptions.campaignSlug,
            collectionKey: detailOptions.collectionKey,
            documentId: detailOptions.documentId,
            allowedVisibilities: detailOptions.allowedVisibilities,
          }),
      });
    },
  };
}
