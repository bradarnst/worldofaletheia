// src/lib/campaign-content-page.ts
//
// Shared logic for rendering campaign root and about pages from Campaign Content
// through the live entry path.
//
// WHY: Issue #9 requires these routes to render from the new Campaign Content
// live loader instead of the legacy static campaign collections. The gate must be
// evaluated before any source fetch, and Content Visibility must still constrain
// what an authenticated reader may view after the gate passes. Keeping this
// decision logic in a pure, injectable library mirrors `campaign-index.ts` and
// makes the gate/visibility/indexability behavior unit-testable without spinning
// up an Astro render.

import {
  campaignGateManifest,
  decideCampaignGateAccess,
  type CampaignAccessRole,
  type CampaignGate,
  type CampaignGateLogger,
  type CampaignGateSource,
  type ContentVisibility,
  type ParsedCampaignGateManifest,
} from '~/lib/campaign-gate-policy';
import type {
  CampaignContentCollectionKey,
  CampaignContentLiveAccessScope,
} from '~/lib/campaign-content-live-loader';
import type { CampaignContentSourceActor } from '~/lib/campaign-content-source-boundary';
import type { CampaignContentLiveEntryData } from '~/lib/campaign-content-live-loader';

/** Minimal structural view of a live entry; avoids a hard dependency on Astro's `LiveDataEntry` export. */
export interface CampaignContentPageEntry {
  id: string;
  data: CampaignContentLiveEntryData;
  rendered?: { html: string };
  cacheHint?: unknown;
}

export type CampaignContentPageLiveEntryGetter = (
  collection: 'campaignContent',
  filter: {
    campaignSlug: string;
    collectionKey: CampaignContentCollectionKey;
    documentId: string;
    accessScope: CampaignContentLiveAccessScope;
  },
) => Promise<{ entry: CampaignContentPageEntry } | { error: unknown }>;

export type CampaignContentPageViewer =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

export type CampaignContentPageReason =
  | 'ok'
  | 'gate_blocked'
  | 'not_found'
  | 'unavailable'
  | 'source_error'
  | 'visibility_mismatch';

export interface CampaignContentPageModel {
  campaignSlug: string;
  documentId: string;
  gate: CampaignGate;
  gateSource: CampaignGateSource;
  campaignAccessRole: CampaignAccessRole;
  gateAllowsRequest: boolean;
  /** False when the gate blocked the request before any source read (per issue #9). */
  sourceFetched: boolean;
  /** True only when an entry was fetched and is viewable for the resolved role. */
  isAvailable: boolean;
  canView: boolean;
  entry: CampaignContentPageEntry | null;
  visibility: ContentVisibility | null;
  /** `null` means the page is indexable; otherwise the literal robots directive. */
  robots: string | null;
  httpStatus: number;
  reason: CampaignContentPageReason;
}

export interface BuildCampaignContentPageModelInput {
  campaignSlug: string;
  documentId: string;
  collectionKey?: CampaignContentCollectionKey;
  viewer: CampaignContentPageViewer;
  /** Resolves the viewer's role for THIS campaign; the page wires this to the request session. */
  getCampaignAccessRole: (campaignSlug: string) => Promise<CampaignAccessRole>;
  getLiveEntry: CampaignContentPageLiveEntryGetter;
  gateManifest?: ParsedCampaignGateManifest;
  logger?: Pick<CampaignGateLogger, 'error'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLiveEntryNotFoundError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const name = typeof error.name === 'string' ? error.name : undefined;
  if (name === 'LiveEntryNotFoundError') {
    return true;
  }

  const constructorName =
    typeof error.constructor === 'object' && error.constructor !== null && 'name' in error.constructor
      ? (error.constructor as { name?: unknown }).name
      : undefined;
  return constructorName === 'LiveEntryNotFoundError';
}

function toActor(viewer: CampaignContentPageViewer): CampaignContentSourceActor {
  if (viewer.kind === 'anonymous') {
    return { kind: 'anonymous' };
  }

  return {
    kind: 'authenticated',
    userId: viewer.userId,
    traceId: viewer.traceId,
  };
}

/**
 * Build the rendering model for a campaign root or about page.
 *
 * Order of operations matters (issue #9):
 *  1. Resolve the viewer's campaign role.
 *  2. Evaluate the Campaign Gate. If it blocks, return immediately WITHOUT touching the source.
 *  3. Only when the gate allows, fetch the Campaign Content item with the gate-derived
 *     `allowedVisibilities`. The source enforces Content Visibility, so a `gm`-only about page
 *     is never returned to an anonymous reader even on a public gate.
 */
export async function buildCampaignContentPageModel(
  input: BuildCampaignContentPageModelInput,
): Promise<CampaignContentPageModel> {
  const campaignSlug = input.campaignSlug.trim();
  const documentId = input.documentId;
  const collectionKey = input.collectionKey ?? 'pages';
  const manifest = input.gateManifest ?? campaignGateManifest;
  const logger = input.logger ?? console;

  const campaignAccessRole = await input.getCampaignAccessRole(campaignSlug);
  const decision = decideCampaignGateAccess({ campaignSlug, manifest, campaignAccessRole, logger });

  const shared = {
    campaignSlug,
    documentId,
    gate: decision.gate,
    gateSource: decision.gateSource,
    campaignAccessRole,
  };

  if (!decision.gateAllowsRequest) {
    return {
      ...shared,
      gateAllowsRequest: false,
      sourceFetched: false,
      isAvailable: false,
      canView: false,
      entry: null,
      visibility: null,
      robots: 'noindex, nofollow',
      httpStatus: 200,
      reason: 'gate_blocked',
    };
  }

  const accessScope: CampaignContentLiveAccessScope = {
    allowedVisibilities: decision.allowedVisibilities,
    actor: toActor(input.viewer),
  };

  let result: { entry: CampaignContentPageEntry } | { error: unknown };
  try {
    result = await input.getLiveEntry('campaignContent', {
      campaignSlug,
      collectionKey,
      documentId,
      accessScope,
    });
  } catch (error) {
    logger.error('campaign.content_page.source_failed', {
      campaignSlug,
      documentId,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return {
      ...shared,
      gateAllowsRequest: true,
      sourceFetched: true,
      isAvailable: false,
      canView: false,
      entry: null,
      visibility: null,
      robots: 'noindex, nofollow',
      httpStatus: 503,
      reason: 'source_error',
    };
  }

  if ('error' in result) {
    if (isLiveEntryNotFoundError(result.error)) {
      return {
        ...shared,
        gateAllowsRequest: true,
        sourceFetched: true,
        isAvailable: false,
        canView: false,
        entry: null,
        visibility: null,
        robots: 'noindex, nofollow',
        httpStatus: 404,
        reason: 'not_found',
      };
    }

    logger.error('campaign.content_page.source_unavailable', {
      campaignSlug,
      documentId,
      errorName: isRecord(result.error) ? String((result.error as { name?: unknown }).name ?? '') : 'unknown',
    });

    return {
      ...shared,
      gateAllowsRequest: true,
      sourceFetched: true,
      isAvailable: false,
      canView: false,
      entry: null,
      visibility: null,
      robots: 'noindex, nofollow',
      httpStatus: 503,
      reason: 'unavailable',
    };
  }

  const entry = result.entry;
  const visibility = entry.data.visibility;
  const canView = decision.allowedVisibilities.includes(visibility);

  if (!canView) {
    // Defensive: the source should already have enforced visibility. Treat as not viewable.
    return {
      ...shared,
      gateAllowsRequest: true,
      sourceFetched: true,
      isAvailable: false,
      canView: false,
      entry: null,
      visibility,
      robots: 'noindex, nofollow',
      httpStatus: 404,
      reason: 'visibility_mismatch',
    };
  }

  // Indexable only when both the gate and the content are public.
  const robots = decision.gate === 'public' && visibility === 'public' ? null : 'noindex, nofollow';

  return {
    ...shared,
    gateAllowsRequest: true,
    sourceFetched: true,
    isAvailable: true,
    canView: true,
    entry,
    visibility,
    robots,
    httpStatus: 200,
    reason: 'ok',
  };
}
