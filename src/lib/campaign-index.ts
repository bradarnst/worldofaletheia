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

function normalizeCampaignSlug(slug: string): string {
  return slug.trim();
}

function normalizeCampaignTitle(title: string): string | null {
  const normalized = title.trim();
  return normalized.length > 0 ? normalized : null;
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

  const campaignModels = await Promise.all(
    campaigns.flatMap((campaign) => {
      const campaignSlug = normalizeCampaignSlug(campaign.slug);
      if (!campaignSlug) {
        logger.error('campaign.index.invalid_slug', { campaignSlug: campaign.slug });
        return [];
      }

      return [
        (async (): Promise<CampaignIndexCampaign> => {
          const gate = getCampaignGate(campaignSlug, gateManifest, { logger });
          const metadataResult = await input.loadCampaignMetadata({ campaignSlug, accessScope });

          if (!metadataResult.ok) {
            logger.error('campaign.index.metadata_unavailable', {
              campaignSlug,
              reason: metadataResult.reason,
            });

            return createUnavailableCampaign({ campaignSlug, gate: gate.gate, gateSource: gate.source });
          }

          const title = normalizeCampaignTitle(metadataResult.title);
          if (!title) {
            logger.error('campaign.index.metadata_unavailable', {
              campaignSlug,
              reason: 'missingTitle',
            });

            return createUnavailableCampaign({ campaignSlug, gate: gate.gate, gateSource: gate.source });
          }

          return {
            slug: campaignSlug,
            href: `/campaigns/${campaignSlug}`,
            title,
            gate: gate.gate,
            gateSource: gate.source,
            isAvailable: true,
          };
        })(),
      ];
    }),
  );

  return {
    campaigns: campaignModels,
    unavailableCampaignCount: campaignModels.filter((campaign) => !campaign.isAvailable).length,
  };
}
