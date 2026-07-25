// src/lib/campaign-notes.ts
//
// Shared logic for rendering a campaign notes *list* from Campaign Content through the
// live collection path.
//
// WHY: Issue #10 renders campaign notes from the generic Campaign Content `notes` collection
// (replacing the unused old Campaign Notes concept). The Campaign Gate must be evaluated
// BEFORE any source fetch, and Content Visibility must constrain what an authenticated
// reader may view after the gate passes — exactly like campaign root/about pages. Keeping
// this decision logic in a pure, injectable library mirrors `campaign-content-page.ts` and
// `campaign-index.ts` so the gate/visibility behavior is unit-testable without an Astro render.

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
  CampaignContentLiveCollectionFilter,
  CampaignContentLiveEntryData,
} from '~/lib/campaign-content-live-loader';
import type { CampaignContentSourceActor } from '~/lib/campaign-content-source-boundary';

/** Minimal structural view of a live entry; avoids a hard dependency on Astro's `LiveDataEntry` export. */
export interface CampaignNotesPageEntry {
  id: string;
  data: CampaignContentLiveEntryData;
  rendered?: { html: string };
  cacheHint?: unknown;
}

export const CAMPAIGN_NOTES_NOINDEX = 'noindex, nofollow';

export type CampaignNotesListViewer =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

export type CampaignNotesListLiveGetter = (
  collection: 'campaignContent',
  filter: CampaignContentLiveCollectionFilter,
) => Promise<{ entries: CampaignNotesPageEntry[] } | { error: unknown }>;

export type CampaignNotesListReason = 'ok' | 'gate_blocked' | 'not_found' | 'unavailable' | 'source_error';

export interface CampaignNotesListEntry {
  documentId: string;
  title: string;
  visibility: ContentVisibility;
  updatedAt: string | null;
  type: string;
  excerpt?: string;
  tags: string[];
  authors: string[];
  href: string;
}

export interface CampaignNotesListModel {
  campaignSlug: string;
  gate: CampaignGate;
  gateSource: CampaignGateSource;
  campaignAccessRole: CampaignAccessRole;
  gateAllowsRequest: boolean;
  /** False when the gate blocked the request before any source read (per issue #10). */
  sourceFetched: boolean;
  isAvailable: boolean;
  entries: CampaignNotesListEntry[];
  /** `null` means the page is indexable; otherwise the literal robots directive. */
  robots: string | null;
  httpStatus: number;
  reason: CampaignNotesListReason;
}

export interface BuildCampaignNotesListModelInput {
  campaignSlug: string;
  viewer: CampaignNotesListViewer;
  /** Resolves the viewer's role for THIS campaign; the page wires this to the request session. */
  getCampaignAccessRole: (campaignSlug: string) => Promise<CampaignAccessRole>;
  getLiveCollection: CampaignNotesListLiveGetter;
  gateManifest?: ParsedCampaignGateManifest;
  logger?: CampaignGateLogger;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toActor(viewer: CampaignNotesListViewer): CampaignContentSourceActor {
  if (viewer.kind === 'anonymous') {
    return { kind: 'anonymous' };
  }

  return {
    kind: 'authenticated',
    userId: viewer.userId,
    traceId: viewer.traceId,
  };
}

function mapNoteEntry(entry: CampaignNotesPageEntry, campaignSlug: string): CampaignNotesListEntry {
  const data = entry.data;
  return {
    documentId: data.documentId,
    title: data.title,
    visibility: data.visibility,
    updatedAt: data.updatedAt,
    type: data.type,
    excerpt: data.excerpt,
    tags: data.tags,
    authors: data.authors,
    href: `/campaigns/${campaignSlug}/notes/${data.documentId}`,
  };
}

/**
 * Build the rendering model for a campaign notes list.
 *
 * Order of operations matters (issue #10):
 *  1. Resolve the viewer's campaign role.
 *  2. Evaluate the Campaign Gate. If it blocks, return immediately WITHOUT touching the source.
 *  3. Only when the gate allows, fetch the `notes` Campaign Content collection with the
 *     gate-derived `allowedVisibilities`. The source enforces Content Visibility, so GM-only
 *     notes are never returned to a member or anonymous reader even on a passed gate.
 */
export async function buildCampaignNotesListModel(
  input: BuildCampaignNotesListModelInput,
): Promise<CampaignNotesListModel> {
  const campaignSlug = input.campaignSlug.trim();
  const collectionKey: CampaignContentCollectionKey = 'notes';
  const manifest = input.gateManifest ?? campaignGateManifest;
  const logger = input.logger ?? console;

  const campaignAccessRole = await input.getCampaignAccessRole(campaignSlug);
  const decision = decideCampaignGateAccess({ campaignSlug, manifest, campaignAccessRole, logger });

  const shared = {
    campaignSlug,
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
      entries: [],
      robots: CAMPAIGN_NOTES_NOINDEX,
      httpStatus: 200,
      reason: 'gate_blocked',
    };
  }

  const accessScope: CampaignContentLiveAccessScope = {
    allowedVisibilities: decision.allowedVisibilities,
    actor: toActor(input.viewer),
  };

  let result: { entries: CampaignNotesPageEntry[] } | { error: unknown };
  try {
    result = await input.getLiveCollection('campaignContent', {
      campaignSlug,
      collectionKey,
      accessScope,
    });
  } catch (error) {
    logger.error('campaign.notes.source_failed', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return {
      ...shared,
      gateAllowsRequest: true,
      sourceFetched: true,
      isAvailable: false,
      entries: [],
      robots: CAMPAIGN_NOTES_NOINDEX,
      httpStatus: 503,
      reason: 'source_error',
    };
  }

  if ('error' in result) {
    logger.error('campaign.notes.source_unavailable', {
      campaignSlug,
      errorName: isRecord(result.error) ? String((result.error as { name?: unknown }).name ?? '') : 'unknown',
    });

    return {
      ...shared,
      gateAllowsRequest: true,
      sourceFetched: true,
      isAvailable: false,
      entries: [],
      robots: CAMPAIGN_NOTES_NOINDEX,
      httpStatus: 503,
      reason: 'unavailable',
    };
  }

  // Defensive: the source should already have enforced visibility, but filter again
  // to match the detail model's hardening (campaign-content-page.ts:232-248).
  const entries = result.entries
    .filter((entry) => decision.allowedVisibilities.includes(entry.data.visibility))
    .map((entry) => mapNoteEntry(entry, campaignSlug));

  // Indexable only when the gate is public. Individual non-public notes carry their own
  // robots directive on their detail pages; the list itself is personalized otherwise.
  const robots = decision.gate === 'public' ? null : CAMPAIGN_NOTES_NOINDEX;

  return {
    ...shared,
    gateAllowsRequest: true,
    sourceFetched: true,
    isAvailable: true,
    entries,
    robots,
    httpStatus: 200,
    reason: 'ok',
  };
}
