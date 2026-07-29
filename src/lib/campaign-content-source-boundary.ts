import { isCampaignGate, type CampaignGate, type ContentVisibility } from '~/lib/campaign-gate-policy';
import type { CampaignContentAssetPath } from '~/lib/campaign-content-asset-rewrite';
import { getCloudflareRuntimeEnv } from '~/utils/cloudflare-env';

export const ASSERTION_EXPIRY_SECONDS = 60;
export const CAMPAIGN_CONTENT_READ_OPERATION = 'content:read';
export const DEFAULT_ASSERTION_AUDIENCE = 'woa-admin:campaign-content:v1';
export const RUNTIME_ASSERTION_HEADER = 'x-woa-runtime-actor';
export const RUNTIME_ASSERTION_SIGNATURE_HEADER = 'x-woa-runtime-signature';
export const CAMPAIGN_CONTENT_ASSET_FETCH_TIMEOUT_MS = 10_000;

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

/** A request viewer, mirroring `CampaignContentPageViewer` from the page model. */
export type CampaignContentViewer =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

/** Maps a request viewer to the non-PII `actor` claim used in runtime assertions. */
export function toCampaignContentSourceActor(viewer: CampaignContentViewer): CampaignContentSourceActor {
  if (viewer.kind === 'anonymous') {
    return { kind: 'anonymous' };
  }
  return { kind: 'authenticated', userId: viewer.userId, traceId: viewer.traceId };
}

export interface CampaignContentRuntimeAssertionPayload {
  aud: string;
  exp: number;
  campaignSlug: string;
  operation: typeof CAMPAIGN_CONTENT_READ_OPERATION;
  allowedVisibility: ContentVisibility[];
  subject: string;
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
  tag?: string;
  author?: string;
  contributor?: string;
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

export interface CampaignSurfaceRegistryItem {
  campaignSlug: string;
  title: string;
  gate: CampaignGate;
  updatedAt: string;
}

export interface CampaignSurfaceRegistry {
  items: CampaignSurfaceRegistryItem[];
}

/**
 * Bucket-relative Campaign Content asset path, e.g. `assets/hero.png` or
 * `assets/maps/region.png`. Mirrors the `path` query parameter accepted by the
 * `woa-admin` asset endpoint. The main-site asset route reconstructs this from
 * the trailing path segments after `/campaigns/{campaign}/assets/`.
 */
export interface CampaignContentAssetOptions extends CampaignContentSourceRequestScope {
  assetPath: CampaignContentAssetPath;
}

export interface CampaignContentAssetBytes {
  body: ReadableStream<Uint8Array> | ArrayBuffer;
  contentType: string | null;
  etag: string | null;
}

export type CampaignContentAssetReadResult =
  | { ok: true; value: CampaignContentAssetBytes }
  | CampaignContentSourceFailure;

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
  listCampaignSurfaces(): Promise<CampaignContentSourceResult<CampaignSurfaceRegistry>>;
  listCampaignContent(options: CampaignContentListOptions): Promise<CampaignContentSourceResult<CampaignContentListPage>>;
  getCampaignContentItem(options: CampaignContentDetailOptions): Promise<CampaignContentSourceResult<CampaignContentItemDetail>>;
  getCampaignContentAsset(options: CampaignContentAssetOptions): Promise<CampaignContentAssetReadResult>;
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

function getStringEnvValue(env: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Resolves the source config for a server runtime, preferring Cloudflare Worker
 * environment bindings (including `wrangler secret put` secrets) and falling back
 * to build-time `import.meta.env` values. Used by on-demand server routes such as
 * the Campaign Content asset proxy.
 */
export async function resolveCampaignContentSourceConfigForRuntime(): Promise<CampaignContentSourceConfig> {
  const runtimeEnv = await getCloudflareRuntimeEnv();
  const fallbackEnv = import.meta.env as EnvLike;
  const merged: EnvLike = {
    CAMPAIGN_CONTENT_SOURCE_BASE_URL:
      getStringEnvValue(runtimeEnv, 'CAMPAIGN_CONTENT_SOURCE_BASE_URL') ?? fallbackEnv.CAMPAIGN_CONTENT_SOURCE_BASE_URL,
    CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET:
      getStringEnvValue(runtimeEnv, 'CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET') ?? fallbackEnv.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET,
    CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE:
      getStringEnvValue(runtimeEnv, 'CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE') ??
      fallbackEnv.CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE,
  };
  return resolveCampaignContentSourceConfig(merged);
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
    chunks.push(chunk.reduce((binary, byte) => binary + String.fromCharCode(byte), ''));
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

async function createRuntimeAssertionSubject(actor: CampaignContentSourceActor, secret: string): Promise<string> {
  if (actor.kind === 'anonymous') {
    return 'anonymous';
  }

  const signature = await signBase64Url(`${actor.userId}:${actor.traceId}`, secret);
  return `auth_${signature.slice(0, 24)}`;
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
    exp: issuedAt + ASSERTION_EXPIRY_SECONDS,
    campaignSlug: input.campaignSlug,
    operation: CAMPAIGN_CONTENT_READ_OPERATION,
    allowedVisibility: [...input.allowedVisibilities],
    subject: await createRuntimeAssertionSubject(input.actor, assertionSecret),
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

const campaignContentCollectionByKey: Record<string, string> = {
  pages: 'campaignPages',
  notes: 'campaignNotes',
  lore: 'campaignLore',
  places: 'campaignPlaces',
  sentients: 'campaignSentients',
  bestiary: 'campaignBestiary',
  flora: 'campaignFlora',
  factions: 'campaignFactions',
  systems: 'campaignSystems',
  meta: 'campaignMeta',
  characters: 'campaignCharacters',
  scenes: 'campaignScenes',
  adventures: 'campaignAdventures',
  hooks: 'campaignHooks',
};

function isPublishPublication(value: unknown): boolean {
  return value === 'publish';
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isRuntimeAssertionPayload(value: unknown): value is CampaignContentRuntimeAssertionPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.aud === 'string'
    && typeof value.exp === 'number'
    && typeof value.campaignSlug === 'string'
    && value.operation === CAMPAIGN_CONTENT_READ_OPERATION
    && Array.isArray(value.allowedVisibility)
    && value.allowedVisibility.every(isContentVisibility)
    && typeof value.subject === 'string'
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

function assertRequiredString(record: Record<string, unknown>, field: string): void {
  getRequiredString(record, field);
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

  const itemCampaignSlug = getRequiredString(input.item, 'campaignSlug');
  assertMatchingField(itemCampaignSlug, input.campaignSlug, 'campaignSlug');

  const collectionKey = getRequiredString(input.item, 'collectionKey');
  const expectedCollection = campaignContentCollectionByKey[collectionKey];
  if (!expectedCollection) {
    throw new Error('Campaign Content source response returned an unsupported collectionKey.');
  }
  if (input.collectionKey) {
    assertMatchingField(collectionKey, input.collectionKey, 'collectionKey');
  }

  const documentId = getRequiredString(input.item, 'id');
  validateDocumentId(documentId);

  const collection = getRequiredString(input.item, 'collection');
  assertMatchingField(collection, expectedCollection, 'collection');
  const data = input.item.data;
  if (!isRecord(data)) {
    throw new Error('Campaign Content source response item is missing data.');
  }
  assertMatchingField(getRequiredString(data, 'campaign'), input.campaignSlug, 'data.campaign');
  assertMatchingField(getRequiredString(data, 'collection'), collection, 'data.collection');

  if (!isPublishPublication(data.publication)) {
    throw new Error('Campaign Content source response returned unpublished content.');
  }

  assertRequiredString(data, 'title');
  assertRequiredString(data, 'type');
  assertRequiredString(data, 'createdAt');
  assertRequiredString(data, 'updatedAt');

  if (!isNonEmptyStringArray(data.authors)) {
    throw new Error('Campaign Content source response is missing authors.');
  }

  const visibility = data.visibility;
  if (!isContentVisibility(visibility) || !input.allowedVisibilities.includes(visibility)) {
    throw new Error('Campaign Content source response returned unreadable or invalid visibility.');
  }

  return {
    campaignSlug: itemCampaignSlug,
    collectionKey,
    documentId,
    title: getRequiredString(data, 'title'),
    visibility,
    updatedAt: getOptionalString(data, 'updatedAt'),
    raw: data,
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

  const body = input.item.markdown;
  if (typeof body !== 'string') {
    throw new Error('Campaign Content source detail response is missing markdown.');
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

function validateIsoDateTime(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`Campaign Content source response has invalid ${field}.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Campaign Content source response has invalid ${field}.`);
  }
}

function validateNoAdditionalProperties(record: Record<string, unknown>, allowedFields: readonly string[], name: string): void {
  for (const field of Object.keys(record)) {
    if (!allowedFields.includes(field)) {
      throw new Error(`${name} includes unsupported field ${field}.`);
    }
  }
}

function validateCampaignSurfaceRegistryItem(item: unknown): CampaignSurfaceRegistryItem {
  if (!isRecord(item)) {
    throw new Error('Campaign Surface Registry item must be an object.');
  }

  validateNoAdditionalProperties(item, ['campaignSlug', 'title', 'gate', 'updatedAt'], 'Campaign Surface Registry item');

  const campaignSlug = getRequiredString(item, 'campaignSlug');
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(campaignSlug)) {
    throw new Error('Campaign Surface Registry item has invalid campaignSlug.');
  }

  const title = getRequiredString(item, 'title').trim();
  if (title.length > 240) {
    throw new Error('Campaign Surface Registry item title is too long.');
  }

  const gate = item.gate;
  if (!isCampaignGate(gate)) {
    throw new Error('Campaign Surface Registry item has invalid gate.');
  }

  const updatedAt = getRequiredString(item, 'updatedAt');
  validateIsoDateTime(updatedAt, 'updatedAt');

  return { campaignSlug, title, gate, updatedAt };
}

function validateCampaignSurfaceRegistryResponse(body: unknown): CampaignSurfaceRegistry {
  if (!isRecord(body)) {
    throw new Error('Campaign Surface Registry response must be an object.');
  }

  validateNoAdditionalProperties(body, ['items'], 'Campaign Surface Registry response');

  const items = body.items;
  if (!Array.isArray(items)) {
    throw new Error('Campaign Surface Registry response is missing items.');
  }

  return {
    items: items.map(validateCampaignSurfaceRegistryItem),
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

  return validateDetailItem({
    item: input.body,
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

function buildListUrl(config: CampaignContentSourceConfig, options: CampaignContentListOptions): string {
  const campaignPath = `/api/v1/campaigns/${encodeURIComponent(options.campaignSlug)}`;
  const documentsPath = options.collectionKey
    ? `${campaignPath}/collections/${encodeURIComponent(options.collectionKey)}/documents`
    : `${campaignPath}/documents`;
  const url = new URL(documentsPath, trimTrailingSlashes(config.baseUrl));
  appendStringFilter(url.searchParams, 'type', options.type);
  appendStringFilter(url.searchParams, 'subtype', options.subtype);
  appendStringFilter(url.searchParams, 'tag', options.tag);
  appendStringFilter(url.searchParams, 'author', options.author);
  appendStringFilter(url.searchParams, 'contributor', options.contributor);
  appendStringFilter(url.searchParams, 'title', options.title);
  appendStringFilter(url.searchParams, 'updatedSince', options.updatedSince);
  if (options.limit !== undefined) {
    url.searchParams.set('limit', String(options.limit));
  }
  appendStringFilter(url.searchParams, 'cursor', options.cursor ?? undefined);
  return url.toString();
}

function buildCampaignSurfaceRegistryUrl(config: CampaignContentSourceConfig): string {
  return new URL('/api/v1/campaigns', trimTrailingSlashes(config.baseUrl)).toString();
}

function buildDetailUrl(config: CampaignContentSourceConfig, options: CampaignContentDetailOptions): string {
  return new URL(
    `/api/v1/campaigns/${encodeURIComponent(options.campaignSlug)}/collections/${encodeURIComponent(options.collectionKey)}/documents/${encodeURIComponent(options.documentId)}`,
    trimTrailingSlashes(config.baseUrl),
  ).toString();
}

function buildAssetUrl(config: CampaignContentSourceConfig, options: CampaignContentAssetOptions): string {
  const url = new URL(
    `/api/v1/campaigns/${encodeURIComponent(options.campaignSlug)}/assets`,
    trimTrailingSlashes(config.baseUrl),
  );
  url.searchParams.set('path', options.assetPath);
  return url.toString();
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Campaign Content source response did not contain valid JSON.');
  }
}

function streamWithTimeoutCleanup(
  stream: ReadableStream<Uint8Array>,
  timeout: ReturnType<typeof setTimeout>,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          clearTimeout(timeout);
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        clearTimeout(timeout);
        controller.error(error);
      }
    },
    async cancel(reason) {
      clearTimeout(timeout);
      await reader.cancel(reason);
    },
  });
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

  /**
   * Streams source asset bytes. Unlike document reads, assets are binary, so the
   * response is read as an `ArrayBuffer` and the source `content-type`/`etag`
   * headers are surfaced for the main-site asset route to forward. Failure mapping
   * is identical to document reads (fail closed, no private-existence leakage).
   */
  async function fetchSourceAsset(input: {
    url: string;
    scope: CampaignContentSourceRequestScope;
  }): Promise<CampaignContentAssetReadResult> {
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
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), CAMPAIGN_CONTENT_ASSET_FETCH_TIMEOUT_MS);
    try {
      response = await fetchImpl(input.url, {
        method: 'GET',
        headers: {
          ...assertionHeaders,
        },
        signal: abortController.signal,
      });
    } catch {
      clearTimeout(timeout);
      return mapCampaignContentSourceFailure({ reason: 'networkFailure' });
    }

    if (!response.ok) {
      clearTimeout(timeout);
      return mapCampaignContentSourceFailure({ status: response.status });
    }

    try {
      const body = response.body ? streamWithTimeoutCleanup(response.body, timeout) : await response.arrayBuffer();
      if (!response.body) {
        clearTimeout(timeout);
      }
      return {
        ok: true,
        value: {
          body,
          contentType: response.headers.get('content-type'),
          etag: response.headers.get('etag'),
        },
      };
    } catch {
      clearTimeout(timeout);
      return mapCampaignContentSourceFailure({ reason: 'validationFailure' });
    }
  }

  return {
    async listCampaignSurfaces() {
      let response: Response;
      try {
        response = await fetchImpl(buildCampaignSurfaceRegistryUrl(config), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
      } catch {
        return mapCampaignContentSourceFailure({ reason: 'networkFailure' });
      }

      if (!response.ok) {
        return mapCampaignContentSourceFailure({ status: response.status });
      }

      try {
        return { ok: true, value: validateCampaignSurfaceRegistryResponse(await readJsonResponse(response)) };
      } catch {
        return mapCampaignContentSourceFailure({ reason: 'validationFailure' });
      }
    },
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
    getCampaignContentAsset(assetOptions) {
      return fetchSourceAsset({
        url: buildAssetUrl(config, assetOptions),
        scope: assetOptions,
      });
    },
  };
}
