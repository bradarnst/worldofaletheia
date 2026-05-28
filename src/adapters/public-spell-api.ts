const DEFAULT_PUBLIC_SPELL_API_BASE = 'https://worldofaletheia.com/api/v1';

function readEnvBase(): string | undefined {
  // Direct import.meta.env.X access is the form Vite/Vitest statically rewrites
  // into a runtime env lookup, so vi.stubEnv() and per-environment overrides
  // propagate correctly. Reading through an aliased object would be inlined at
  // module-load time and miss later overrides.
  const candidate = import.meta.env?.PUBLIC_SPELL_API_BASE;
  if (typeof candidate !== 'string') {
    return undefined;
  }
  const trimmed = candidate.trim().replace(/\/+$/, '');
  return trimmed === '' ? undefined : trimmed;
}

export interface PublicSpellSourceLineage {
  source_spell_name: string;
  source_spell_types: string[];
}

export interface PublicSpell {
  spell_id: string;
  spell_name: string;
  spell_types: string[];
  keywords: string[];
  archmagisters_counsel: string;
  source_lineage: PublicSpellSourceLineage;
  full_cost: string;
  casting_roll: string;
  range: string;
  duration: string;
  description: string;
  statistics: string;
}

export interface PublicSpellSuggestion {
  spell_id: string;
  spell_name: string;
  spell_types: string[];
}

export interface PublicSpellPage {
  items: PublicSpell[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
  name: string;
  type: string;
  sourceName: string;
  sourceType: string;
}

export interface PublicSpellErrorResponse {
  error: string;
  message: string;
}

type PayloadGuard<T> = (value: unknown) => value is T;

export interface ListSpellsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  name?: string;
  type?: string;
  sourceName?: string;
  sourceType?: string;
}

export interface SuggestSpellsParams {
  q?: string;
  type?: string;
  sourceName?: string;
  sourceType?: string;
  limit?: number;
}

interface FetchPublicSpellApiOptions {
  path: string;
  query?: Record<string, string | number | undefined>;
  validate?: PayloadGuard<unknown>;
  request?: RequestInit;
}

const BROWSER_SPELL_DETAIL_REQUEST: RequestInit = {
  method: 'GET',
  mode: 'cors',
  credentials: 'omit',
  headers: {
    Accept: 'application/json',
  },
};

export class PublicSpellApiError extends Error {
  status: number;
  error: string;
  retryAfter: string | null;

  constructor({
    status,
    error,
    message,
    retryAfter = null,
    cause,
  }: {
    status: number;
    error: string;
    message: string;
    retryAfter?: string | null;
    cause?: unknown;
  }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PublicSpellApiError';
    this.status = status;
    this.error = error;
    this.retryAfter = retryAfter;
  }
}

function getPublicSpellApiBase(): string {
  return readEnvBase() ?? DEFAULT_PUBLIC_SPELL_API_BASE;
}

function buildPublicSpellApiUrl({ path, query = {} }: FetchPublicSpellApiOptions): URL {
  const url = new URL(`${getPublicSpellApiBase()}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

function isErrorResponse(value: unknown): value is PublicSpellErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.error === 'string' && typeof candidate.message === 'string';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isPublicSpellSourceLineage(value: unknown): value is PublicSpellSourceLineage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isString(candidate.source_spell_name) && isStringArray(candidate.source_spell_types);
}

function isPublicSpell(value: unknown): value is PublicSpell {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isString(candidate.spell_id)
    && isString(candidate.spell_name)
    && isStringArray(candidate.spell_types)
    && isStringArray(candidate.keywords)
    && isString(candidate.archmagisters_counsel)
    && isPublicSpellSourceLineage(candidate.source_lineage)
    && isString(candidate.full_cost)
    && isString(candidate.casting_roll)
    && isString(candidate.range)
    && isString(candidate.duration)
    && isString(candidate.description)
    && isString(candidate.statistics);
}

function isPublicSpellSuggestion(value: unknown): value is PublicSpellSuggestion {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isString(candidate.spell_id)
    && isString(candidate.spell_name)
    && isStringArray(candidate.spell_types);
}

function isPublicSpellPage(value: unknown): value is PublicSpellPage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.items)
    && candidate.items.every(isPublicSpell)
    && isFiniteNumber(candidate.total)
    && isFiniteNumber(candidate.page)
    && isFiniteNumber(candidate.pageSize)
    && isFiniteNumber(candidate.totalPages)
    && isString(candidate.q)
    && isString(candidate.name)
    && isString(candidate.type)
    && isString(candidate.sourceName)
    && isString(candidate.sourceType);
}

function isPublicSpellTypeList(value: unknown): value is string[] {
  return isStringArray(value);
}

function isPublicSpellSuggestionList(value: unknown): value is PublicSpellSuggestion[] {
  return Array.isArray(value) && value.every(isPublicSpellSuggestion);
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  // Accept application/json and any +json subtype (e.g. application/problem+json).
  // Tolerate parameters like charset by inspecting only the media type prefix.
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mediaType === 'application/json' || mediaType === 'text/json') {
    return true;
  }
  return mediaType.endsWith('+json');
}

async function parseResponseJson(response: Response): Promise<unknown> {
  // Guard against upstream/CDN error pages (HTML, plain text) being parsed as
  // JSON. Without this, a Cloudflare error page would surface as an opaque
  // SyntaxError rather than the documented service_unavailable contract error.
  if (!isJsonContentType(response.headers.get('content-type'))) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        `[public-spell-api] Non-JSON response from ${response.url || 'public spell API'} (status ${response.status}, content-type ${response.headers.get('content-type') ?? 'unknown'}).`,
      );
    }
    throw new PublicSpellApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      retryAfter: response.headers.get('Retry-After'),
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new PublicSpellApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      retryAfter: response.headers.get('Retry-After'),
      cause,
    });
  }
}

async function fetchPublicSpellApi<T>({ path, query, validate, request }: FetchPublicSpellApiOptions): Promise<T> {
  const url = buildPublicSpellApiUrl({ path, query });

  let response: Response;
  try {
    response = request ? await fetch(url, request) : await fetch(url);
  } catch (cause) {
    throw new PublicSpellApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      cause,
    });
  }

  const retryAfter = response.headers.get('Retry-After');
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    if (isErrorResponse(payload)) {
      throw new PublicSpellApiError({
        status: response.status,
        error: payload.error,
        message: payload.message,
        retryAfter,
      });
    }

    throw new PublicSpellApiError({
      status: response.status,
      error: response.status >= 500 ? 'service_unavailable' : 'unexpected_error',
      message: `Public spell API request failed with status ${response.status}.`,
      retryAfter,
    });
  }

  if (validate && !validate(payload)) {
    throw new PublicSpellApiError({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      retryAfter,
    });
  }

  return payload as T;
}

export function isPublicSpellApiError(error: unknown): error is PublicSpellApiError {
  return error instanceof PublicSpellApiError;
}

export async function listSpellTypes(): Promise<string[]> {
  return fetchPublicSpellApi<string[]>({ path: '/spell-types', validate: isPublicSpellTypeList });
}

export async function listSourceSpellTypes(): Promise<string[]> {
  return fetchPublicSpellApi<string[]>({ path: '/source-spell-types', validate: isPublicSpellTypeList });
}

export async function listSpells(params: ListSpellsParams = {}): Promise<PublicSpellPage> {
  return fetchPublicSpellApi<PublicSpellPage>({
    path: '/spells',
    query: {
      page: params.page,
      pageSize: params.pageSize,
      q: params.q,
      name: params.name,
      type: params.type,
      sourceName: params.sourceName,
      sourceType: params.sourceType,
    },
    validate: isPublicSpellPage,
  });
}

export async function getSpellById(spellId: string): Promise<PublicSpell> {
  return fetchPublicSpellApi<PublicSpell>({
    path: `/spells/${encodeURIComponent(spellId)}`,
    validate: isPublicSpell,
  });
}

export async function getSpellByIdForBrowser(spellId: string): Promise<PublicSpell> {
  return fetchPublicSpellApi<PublicSpell>({
    path: `/spells/${encodeURIComponent(spellId)}`,
    validate: isPublicSpell,
    request: BROWSER_SPELL_DETAIL_REQUEST,
  });
}

export async function suggestSpells(params: SuggestSpellsParams = {}): Promise<PublicSpellSuggestion[]> {
  return fetchPublicSpellApi<PublicSpellSuggestion[]>({
    path: '/spell-suggestions',
    query: {
      q: params.q,
      type: params.type,
      sourceName: params.sourceName,
      sourceType: params.sourceType,
      limit: params.limit,
    },
    validate: isPublicSpellSuggestionList,
  });
}
