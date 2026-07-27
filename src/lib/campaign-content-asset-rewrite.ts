// src/lib/campaign-content-asset-rewrite.ts
//
// Rewrites Campaign Content Markdown asset references to main-site asset URLs.
//
// WHY (issue #11): Campaign Content Markdown is served by `woa-admin` and may
// reference source assets via the `woa-admin` asset endpoint or bucket-relative
// `assets/...` paths. Browsers must never call `woa-admin` directly, so those
// references are rewritten to the main-site asset route
// `/campaigns/{campaign}/assets/{rest}` which proxies the bytes with the same
// Campaign Gate + membership-derived visibility scope as content reads.
//
// The main-site route keeps the `assets/` prefix implicit: a source path
// `assets/hero.png` maps to `/campaigns/{campaign}/assets/hero.png`.

const ASSET_ENDPOINT_RE = /\/api\/v1\/campaigns\/([^/]+)\/assets$/;
const MAIN_SITE_ASSET_PREFIX = '/campaigns';
const RELATIVE_URL_BASE = 'http://_relative_.invalid';
const APPROVED_SOURCE_ORIGINS = new Set(['https://admin.worldofaletheia.com', 'https://woa-admin.worldofaletheia.com']);

declare const campaignContentAssetPathBrand: unique symbol;
export type CampaignContentAssetPath = string & { readonly [campaignContentAssetPathBrand]: true };

/**
 * Validates a bucket-relative Campaign Content asset path. Mirrors the contract
 * pattern: must begin with `assets/`, be 8–512 characters, contain no traversal
 * (`..` / `.` segments), no empty segments (`//`), no backslashes, and must not
 * reference Markdown.
 */
export function isValidCampaignContentAssetPath(path: string): boolean {
  if (!path.startsWith('assets/') || path.length < 8 || path.length > 512) {
    return false;
  }

  const segments = path.split('/');
  if (segments[0] !== 'assets') {
    return false;
  }

  for (const segment of segments) {
    if (segment.length === 0) {
      return false;
    }
    if (segment === '.' || segment === '..') {
      return false;
    }
    if (segment.includes('\\')) {
      return false;
    }
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment.endsWith('.md')) {
    return false;
  }

  return true;
}

export function toCampaignContentAssetPath(path: string): CampaignContentAssetPath | null {
  return isValidCampaignContentAssetPath(path) ? (path as CampaignContentAssetPath) : null;
}

function buildMainSiteAssetUrl(campaignSlug: string, assetPath: CampaignContentAssetPath): string {
  const rest = assetPath.slice('assets/'.length).split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${MAIN_SITE_ASSET_PREFIX}/${encodeURIComponent(campaignSlug)}/assets/${rest}`;
}

/**
 * Maps a single asset URL to the main-site asset route, or returns `null` when
 * the URL is not a recognizable Campaign Content asset reference.
 *
 * Recognized forms:
 *  - `woa-admin` asset endpoint: `/api/v1/campaigns/{slug}/assets?path=assets/...`
 *    (with or without an origin). The campaign slug embedded in the URL is
 *    preserved so cross-campaign references are not silently reassigned.
 *  - bucket-relative references: `assets/...`, `./assets/...`, `/assets/...`
 *    (no slug in the reference, so the caller's campaign slug is used)
 *
 * Non-asset URLs (doc links, external images, etc.) return `null` and are left
 * unchanged by the caller.
 */
function isApprovedOrConfiguredSourceOrigin(parsed: URL, sourceBaseUrl?: string): boolean {
  const configuredOrigin = normalizeOrigin(sourceBaseUrl);
  return parsed.origin === configuredOrigin || APPROVED_SOURCE_ORIGINS.has(parsed.origin);
}

export function mapCampaignAssetReferenceToMainSite(rawUrl: string, campaignSlug: string, sourceBaseUrl?: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, RELATIVE_URL_BASE);
  } catch {
    return null;
  }

  const endpointMatch = ASSET_ENDPOINT_RE.exec(parsed.pathname);
  if (endpointMatch) {
    if (parsed.origin !== RELATIVE_URL_BASE && !isApprovedOrConfiguredSourceOrigin(parsed, sourceBaseUrl)) {
      return null;
    }

    const assetPath = parsed.searchParams.get('path');
    const validAssetPath = assetPath ? toCampaignContentAssetPath(assetPath) : null;
    if (validAssetPath) {
      return buildMainSiteAssetUrl(campaignSlug, validAssetPath);
    }
    return null;
  }

  if (parsed.origin !== RELATIVE_URL_BASE) {
    return null;
  }

  let candidate: string;
  try {
    candidate = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (candidate.startsWith('/')) {
    candidate = candidate.slice(1);
  }
  if (candidate.startsWith('./')) {
    candidate = candidate.slice(2);
  }

  const validCandidate = toCampaignContentAssetPath(candidate);
  if (validCandidate) {
    return buildMainSiteAssetUrl(campaignSlug, validCandidate);
  }

  return null;
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function isSourceBoundaryUrl(rawUrl: string, sourceBaseUrl?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, RELATIVE_URL_BASE);
  } catch {
    return false;
  }

  if (parsed.origin === RELATIVE_URL_BASE) {
    return parsed.pathname.startsWith('/api/v1/campaigns/');
  }

  return isApprovedOrConfiguredSourceOrigin(parsed, sourceBaseUrl);
}

function mapOrNeutralizeSourceUrl(rawUrl: string, campaignSlug: string, sourceBaseUrl?: string): string | null {
  return mapCampaignAssetReferenceToMainSite(rawUrl, campaignSlug, sourceBaseUrl) ?? (isSourceBoundaryUrl(rawUrl, sourceBaseUrl) ? '#' : null);
}

const MARKDOWN_LINK_RE = /(\!?\[[^\]]*\]\()([^)\s]+)(\))/g;
const MARKDOWN_REFERENCE_DEFINITION_RE = /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)(.*)$/gm;
const HTML_ASSET_ATTR_RE = /\b(src|href)=(["'])([^"']+)\2/gi;

/**
 * Rewrites Campaign Content asset references in Markdown (or rendered-HTML-like
 * fragments) to main-site asset URLs. Image/link syntax and inline `src`/`href`
 * attributes are considered; every other URL is preserved verbatim.
 */
export function rewriteCampaignContentAssetReferences(input: string, context: { campaignSlug: string; sourceBaseUrl?: string }): string {
  const campaignSlug = context.campaignSlug.trim();

  let result = input.replace(MARKDOWN_LINK_RE, (_match, pre: string, url: string, post: string) => {
    const mapped = mapOrNeutralizeSourceUrl(url, campaignSlug, context.sourceBaseUrl);
    return mapped ? `${pre}${mapped}${post}` : _match;
  });

  result = result.replace(MARKDOWN_REFERENCE_DEFINITION_RE, (_match, pre: string, url: string, post: string) => {
    const mapped = mapOrNeutralizeSourceUrl(url, campaignSlug, context.sourceBaseUrl);
    return mapped ? `${pre}${mapped}${post}` : _match;
  });

  result = result.replace(HTML_ASSET_ATTR_RE, (_match, attr: string, quote: string, url: string) => {
    const mapped = mapOrNeutralizeSourceUrl(url, campaignSlug, context.sourceBaseUrl);
    return mapped ? `${attr}=${quote}${mapped}${quote}` : _match;
  });

  return result;
}
