// src/lib/campaign-content-asset-handler.ts
//
// Server handler for the main-site Campaign Content asset route
// `/campaigns/{campaign}/assets/{rest}`.
//
// WHY (issue #11): Campaign Content Markdown references source assets owned by
// `woa-admin`. Browsers must never call `woa-admin` or receive runtime
// assertions, so this handler proxies the asset bytes through worldofaletheia.com.
// Access derives from the same Campaign Gate + membership + cumulative Content
// Visibility scope used for content reads; the route signs a short-lived
// campaign-scoped assertion, fetches the source bytes, and streams them back.
// Missing or unreadable assets fail closed to a generic not-found/unavailable
// response that never reveals private existence.

import {
  createCampaignContentSourceClient,
  resolveCampaignContentSourceConfigForRuntime,
  toCampaignContentSourceActor,
  type CampaignContentSourceClient,
} from '~/lib/campaign-content-source-boundary';
import {
  campaignGateManifest,
  decideCampaignGateAccess,
  isUnknownCampaignGateSource,
  type CampaignGateLogger,
  type ParsedCampaignGateManifest,
} from '~/lib/campaign-gate-policy';
import { createCampaignPageRequestContext } from '~/lib/campaign-page-request-context';
import { toCampaignContentAssetPath } from '~/lib/campaign-content-asset-rewrite';

export interface HandleCampaignContentAssetRequestInput {
  request: Request;
  locals: unknown;
  params: { campaign?: string; path?: string };
  url: URL;
  /** Inject a source client for tests; defaults to a real `woa-admin` client. */
  createSourceClient?: () => CampaignContentSourceClient | Promise<CampaignContentSourceClient>;
  logger?: CampaignGateLogger;
  gateManifest?: ParsedCampaignGateManifest;
  requireKnownCampaignGate?: boolean;
}

export const CAMPAIGN_CONTENT_ASSET_NOINDEX_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
};

const DEFAULT_ASSET_CONTENT_TYPE = 'application/octet-stream';
const SAFE_ASSET_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'video/mp4',
  'video/webm',
]);

function noIndexHeaders(): Headers {
  return new Headers(CAMPAIGN_CONTENT_ASSET_NOINDEX_HEADERS);
}

function normalizeAssetContentType(contentType: string | null): string {
  const trimmed = contentType?.trim();
  if (!trimmed) {
    return DEFAULT_ASSET_CONTENT_TYPE;
  }
  const mediaType = trimmed.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType && SAFE_ASSET_CONTENT_TYPES.has(mediaType) ? trimmed : DEFAULT_ASSET_CONTENT_TYPE;
}

/**
 * Handles one Campaign Content asset request. Returns a generic not-found (404)
 * or unavailable (503) response on any failure path so private asset existence
 * is never leaked to the browser.
 */
export async function handleCampaignContentAssetRequest(
  input: HandleCampaignContentAssetRequestInput,
): Promise<Response> {
  const logger = input.logger ?? console;
  const campaignSlug = input.params.campaign?.trim() ?? '';
  const assetRestPath = input.params.path;

  if (!campaignSlug || !assetRestPath) {
    return new Response(null, { status: 404, headers: noIndexHeaders() });
  }

  // The main-site route keeps the `assets/` prefix implicit; reconstruct the
  // bucket-relative source path expected by `woa-admin`.
  const sourceAssetPath = toCampaignContentAssetPath(`assets/${assetRestPath}`);
  if (!sourceAssetPath) {
    return new Response(null, { status: 404, headers: noIndexHeaders() });
  }

  let ctx: Awaited<ReturnType<typeof createCampaignPageRequestContext>>;
  try {
    ctx = await createCampaignPageRequestContext({
      request: input.request,
      locals: input.locals,
      hostname: input.url.hostname,
    });
  } catch (error) {
    logger.error('campaign.asset.context_failed', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return new Response(null, { status: 503, headers: noIndexHeaders() });
  }

  const campaignAccessRole = await ctx.getCampaignAccessRole(campaignSlug);
  const decision = decideCampaignGateAccess({
    campaignSlug,
    manifest: input.gateManifest ?? campaignGateManifest,
    campaignAccessRole,
    logger,
  });

  if (input.requireKnownCampaignGate && isUnknownCampaignGateSource(decision.gateSource)) {
    return new Response(null, { status: 404, headers: noIndexHeaders() });
  }

  // Anonymous blocked by a campaignMembers gate: stop before any source fetch.
  if (!decision.gateAllowsRequest) {
    return new Response(null, { status: 404, headers: noIndexHeaders() });
  }

  let client: CampaignContentSourceClient;
  try {
    client =
      input.createSourceClient !== undefined
        ? await input.createSourceClient()
        : createCampaignContentSourceClient({ config: await resolveCampaignContentSourceConfigForRuntime() });
  } catch (error) {
    logger.error('campaign.asset.source_config_unavailable', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return new Response(null, { status: 503, headers: noIndexHeaders() });
  }

  let result: Awaited<ReturnType<CampaignContentSourceClient['getCampaignContentAsset']>>;
  try {
    result = await client.getCampaignContentAsset({
      campaignSlug,
      assetPath: sourceAssetPath,
      allowedVisibilities: decision.allowedVisibilities,
      actor: toCampaignContentSourceActor(ctx.viewer),
    });
  } catch {
    logger.error('campaign.asset.source_failed', { campaignSlug });
    return new Response(null, { status: 503, headers: noIndexHeaders() });
  }

  if (!result.ok) {
    logger.error('campaign.asset.source_unavailable', {
      campaignSlug,
      reason: result.reason,
      sourceStatus: result.sourceStatus,
    });
    return new Response(null, { status: result.mainSiteStatus, headers: noIndexHeaders() });
  }

  const headers = noIndexHeaders();
  headers.set('content-type', normalizeAssetContentType(result.value.contentType));
  if (result.value.etag) {
    headers.set('etag', result.value.etag);
  }
  // The source defaults responses to no-store; mirror that for proxied assets.
  headers.set('cache-control', 'no-store');

  return new Response(result.value.body, { status: 200, headers });
}
