import {
  campaignGateManifest,
  getCampaignGate,
  type CampaignGate,
  type CampaignGateLogger,
  type CampaignGateSource,
  type ParsedCampaignGateManifest,
} from '~/lib/campaign-gate-policy';
import type { CampaignContentLiveAccessScope } from '~/lib/campaign-content-live-loader';

export interface CampaignIndexCampaignConfig {
  slug: string;
}

export type CampaignIndexViewer =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

export type CampaignIndexMetadataResult =
  | { ok: true; title: string }
  | { ok: false; reason: string };

export type CampaignIndexMetadataLoader = (input: {
  campaignSlug: string;
  accessScope: CampaignContentLiveAccessScope;
}) => Promise<CampaignIndexMetadataResult>;

export interface CampaignIndexLiveEntry {
  data: {
    title: string;
  };
}

export interface CampaignIndexLiveEntryResult {
  // Astro's LiveDataEntryResult uses optional fields so an absent entry is a valid not-found result.
  entry?: CampaignIndexLiveEntry;
  error?: unknown;
}

export type CampaignIndexLiveEntryGetter = (
  collection: 'campaignContent',
  filter: {
    campaignSlug: string;
    collectionKey: 'pages';
    documentId: 'index';
    accessScope: CampaignContentLiveAccessScope;
  },
) => Promise<CampaignIndexLiveEntryResult>;

export interface CampaignIndexLiveMetadataLoaderOptions {
  getLiveEntry: CampaignIndexLiveEntryGetter;
  logger?: Pick<CampaignGateLogger, 'error'>;
}

export interface CampaignIndexCampaign {
  slug: string;
  href: string;
  title: string;
  gate: CampaignGate;
  gateSource: CampaignGateSource;
  isAvailable: boolean;
  unavailableMessage?: string;
}

export interface CampaignIndexModel {
  campaigns: CampaignIndexCampaign[];
  unavailableCampaignCount: number;
}

// V1 has no cross-campaign source endpoint. Keep only public discovery slugs here; titles still come from the
// Campaign Content live path so this registry does not become a second title/detail source.
export const CAMPAIGN_INDEX_CAMPAIGNS = [
  { slug: 'brad' },
  { slug: 'barry' },
  { slug: 'sample-campaign' },
] as const satisfies readonly CampaignIndexCampaignConfig[];

const genericUnavailableTitle = 'Campaign temporarily unavailable';
const genericUnavailableMessage = 'Campaign discovery is temporarily unavailable.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringProperty(value: unknown, property: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const propertyValue = value[property];
  return typeof propertyValue === 'string' && propertyValue.length > 0 ? propertyValue : undefined;
}

function getRecordProperty(value: unknown, property: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const propertyValue = value[property];
  return isRecord(propertyValue) ? propertyValue : undefined;
}

function getSourceFailureReason(error: unknown): string | undefined {
  const sourceFailure = getRecordProperty(error, 'sourceFailure') ?? getRecordProperty(getRecordProperty(error, 'cause'), 'sourceFailure');
  return getStringProperty(sourceFailure, 'reason');
}

function getLiveErrorDiagnostics(error: unknown, fallbackReason: string): { reason: string; details: Record<string, string> } {
  const cause = getRecordProperty(error, 'cause');
  const name = getStringProperty(error, 'name');
  const message = getStringProperty(error, 'message');
  const causeName = getStringProperty(cause, 'name');
  const causeMessage = getStringProperty(cause, 'message');
  const sourceFailureReason = getSourceFailureReason(error);
  const details: Record<string, string> = {};

  if (name) {
    details.name = name;
  }
  if (message) {
    details.message = message;
  }
  if (causeName) {
    details.causeName = causeName;
  }
  if (causeMessage) {
    details.causeMessage = causeMessage;
  }
  if (sourceFailureReason) {
    details.sourceFailureReason = sourceFailureReason;
  }

  return {
    reason: sourceFailureReason ?? name ?? causeName ?? fallbackReason,
    details,
  };
}

function isMissingLiveEntry(error: unknown): boolean {
  return getStringProperty(error, 'name') === 'LiveEntryNotFoundError';
}

function normalizeCampaignSlug(slug: string): string {
  return slug.trim();
}

function normalizeCampaignTitle(title: unknown): { ok: true; title: string } | { ok: false; reason: 'missingTitle' | 'malformedTitle' } {
  if (typeof title !== 'string') {
    return { ok: false, reason: 'malformedTitle' };
  }

  const normalized = title.trim();
  return normalized.length > 0 ? { ok: true, title: normalized } : { ok: false, reason: 'missingTitle' };
}

function createUnavailableCampaign(input: {
  campaignSlug: string;
  gate: CampaignGate;
  gateSource: CampaignGateSource;
}): CampaignIndexCampaign {
  return {
    slug: input.campaignSlug,
    href: `/campaigns/${input.campaignSlug}`,
    title: genericUnavailableTitle,
    gate: input.gate,
    gateSource: input.gateSource,
    isAvailable: false,
    unavailableMessage: genericUnavailableMessage,
  };
}

export function createCampaignIndexLiveMetadataLoader(options: CampaignIndexLiveMetadataLoaderOptions): CampaignIndexMetadataLoader {
  const logger = options.logger ?? console;

  return async ({ campaignSlug, accessScope }) => {
    try {
      const result = await options.getLiveEntry('campaignContent', {
        campaignSlug,
        collectionKey: 'pages',
        documentId: 'index',
        accessScope,
      });

      if (result.error) {
        if (isMissingLiveEntry(result.error)) {
          return { ok: false, reason: 'missingCampaignRoot' };
        }

        const diagnostics = getLiveErrorDiagnostics(result.error, 'liveEntryError');
        logger.error('campaign.index.live_entry_error', {
          campaignSlug,
          reason: diagnostics.reason,
          ...diagnostics.details,
        });

        return { ok: false, reason: diagnostics.reason };
      }

      if (!result.entry) {
        return { ok: false, reason: 'missingCampaignRoot' };
      }

      return { ok: true, title: result.entry.data.title };
    } catch (error) {
      const diagnostics = getLiveErrorDiagnostics(error, 'liveEntryFailed');
      logger.error('campaign.index.live_entry_failed', {
        campaignSlug,
        reason: diagnostics.reason,
        ...diagnostics.details,
      });

      return { ok: false, reason: diagnostics.reason };
    }
  };
}

export function createCampaignIndexDiscoveryAccessScope(viewer: CampaignIndexViewer): CampaignContentLiveAccessScope {
  return {
    // Campaign Index reads stay public-only. Campaign Gate may still require membership for entering the campaign,
    // but campaign titles used for discovery must be exposed by the source as public metadata.
    allowedVisibilities: ['public'],
    actor: viewer,
  };
}

export async function buildCampaignIndexModel(input: {
  campaigns?: readonly CampaignIndexCampaignConfig[];
  viewer: CampaignIndexViewer;
  gateManifest?: ParsedCampaignGateManifest;
  logger?: CampaignGateLogger;
  loadCampaignMetadata: CampaignIndexMetadataLoader;
}): Promise<CampaignIndexModel> {
  const campaigns = input.campaigns ?? CAMPAIGN_INDEX_CAMPAIGNS;
  const gateManifest = input.gateManifest ?? campaignGateManifest;
  const logger = input.logger ?? console;
  const accessScope = createCampaignIndexDiscoveryAccessScope(input.viewer);

  const campaignMetadataTasks: Promise<CampaignIndexCampaign>[] = [];

  for (const campaign of campaigns) {
    const campaignSlug = normalizeCampaignSlug(campaign.slug);
    if (!campaignSlug) {
      logger.error('campaign.index.invalid_slug', { campaignSlug: campaign.slug });
      continue;
    }

    campaignMetadataTasks.push(
      (async (): Promise<CampaignIndexCampaign> => {
        const gate = getCampaignGate(campaignSlug, gateManifest, { logger });
        try {
          const metadataResult = await input.loadCampaignMetadata({ campaignSlug, accessScope });

          if (!metadataResult.ok) {
            logger.error('campaign.index.metadata_unavailable', {
              campaignSlug,
              reason: metadataResult.reason,
            });

            return createUnavailableCampaign({ campaignSlug, gate: gate.gate, gateSource: gate.source });
          }

          const titleResult = normalizeCampaignTitle(metadataResult.title);
          if (!titleResult.ok) {
            logger.error('campaign.index.metadata_unavailable', {
              campaignSlug,
              reason: titleResult.reason,
            });

            return createUnavailableCampaign({ campaignSlug, gate: gate.gate, gateSource: gate.source });
          }

          return {
            slug: campaignSlug,
            href: `/campaigns/${campaignSlug}`,
            title: titleResult.title,
            gate: gate.gate,
            gateSource: gate.source,
            isAvailable: true,
          };
        } catch (error) {
          logger.error('campaign.index.metadata_unavailable', {
            campaignSlug,
            reason: 'loaderRejected',
            message: error instanceof Error ? error.message : 'unknown error',
          });

          return createUnavailableCampaign({ campaignSlug, gate: gate.gate, gateSource: gate.source });
        }
      })(),
    );
  }

  const campaignModels = await Promise.all(campaignMetadataTasks);

  return {
    campaigns: campaignModels,
    unavailableCampaignCount: campaignModels.filter((campaign) => !campaign.isAvailable).length,
  };
}
