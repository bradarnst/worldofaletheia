import {
  parseCampaignGateManifest,
  type ParsedCampaignGateManifest,
  type CampaignGate,
  type CampaignGateLogger,
} from '~/lib/campaign-gate-policy';
import {
  createCampaignContentSourceClient,
  resolveCampaignContentSourceConfigForRuntime,
  type CampaignSurfaceRegistryItem,
} from '~/lib/campaign-content-source-boundary';

export interface CampaignIndexCampaignConfig {
  slug?: string;
  campaignSlug?: string;
  title?: string;
  gate?: CampaignGate;
}

export type CampaignIndexViewer =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userId: string; traceId: string };

export type CampaignSurfaceRegistryLoader = () => Promise<readonly CampaignSurfaceRegistryItem[]>;

export interface CampaignIndexCampaign {
  slug: string;
  href: string;
  title: string;
  gate: CampaignGate;
  gateSource: 'registry';
  isAvailable: boolean;
  unavailableMessage?: string;
}

export interface CampaignIndexModel {
  campaigns: CampaignIndexCampaign[];
  unavailableCampaignCount: number;
}

const genericUnavailableMessage = 'Campaign discovery is temporarily unavailable.';

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
  title: string;
  gate: CampaignGate;
}): CampaignIndexCampaign {
  return {
    slug: input.campaignSlug,
    href: `/campaigns/${input.campaignSlug}`,
    title: input.title,
    gate: input.gate,
    gateSource: 'registry',
    isAvailable: false,
    unavailableMessage: genericUnavailableMessage,
  };
}

export function createCampaignSurfaceRegistryLoader(): CampaignSurfaceRegistryLoader {
  return async () => {
    const config = await resolveCampaignContentSourceConfigForRuntime();
    const client = createCampaignContentSourceClient({ config });
    const result = await client.listCampaignSurfaces();
    if (!result.ok) {
      throw new Error(result.reason);
    }
    return result.value.items;
  };
}

export async function loadCampaignSurfaceGateManifest(input: {
  loadCampaignSurfaces?: CampaignSurfaceRegistryLoader;
} = {}): Promise<ParsedCampaignGateManifest> {
  const loadCampaignSurfaces = input.loadCampaignSurfaces ?? createCampaignSurfaceRegistryLoader();
  const surfaces = await loadCampaignSurfaces();
  return parseCampaignGateManifest(
    Object.fromEntries(surfaces.map((surface) => [surface.campaignSlug, surface.gate])),
    { source: 'registry' },
  );
}

export async function loadCampaignSurfaceGateManifestFailClosed(input: {
  loadCampaignSurfaces?: CampaignSurfaceRegistryLoader;
} = {}): Promise<ParsedCampaignGateManifest> {
  try {
    return await loadCampaignSurfaceGateManifest(input);
  } catch {
    return parseCampaignGateManifest({}, { source: 'registry' });
  }
}

export async function buildCampaignIndexModel(input: {
  campaigns?: readonly CampaignIndexCampaignConfig[];
  viewer: CampaignIndexViewer;
  logger?: CampaignGateLogger;
  loadCampaignSurfaces: CampaignSurfaceRegistryLoader;
}): Promise<CampaignIndexModel> {
  const logger = input.logger ?? console;
  let campaigns: readonly CampaignIndexCampaignConfig[];
  try {
    campaigns = input.campaigns ?? await input.loadCampaignSurfaces();
  } catch (error) {
    logger.error('campaign.index.registry_unavailable', {
      reason: error instanceof Error ? error.message : 'unknown error',
    });
    return { campaigns: [], unavailableCampaignCount: 0 };
  }

  const campaignMetadataTasks: Promise<CampaignIndexCampaign>[] = [];

  for (const campaign of campaigns) {
    const rawCampaignSlug = campaign.campaignSlug ?? campaign.slug ?? '';
    const campaignSlug = normalizeCampaignSlug(rawCampaignSlug);
    if (!campaignSlug) {
      logger.error('campaign.index.invalid_slug', { campaignSlug: rawCampaignSlug });
      continue;
    }

    campaignMetadataTasks.push(
      (async (): Promise<CampaignIndexCampaign> => {
        const gate = campaign.gate ?? 'campaignMembers';
        try {
          const titleResult = normalizeCampaignTitle(campaign.title);
          if (!titleResult.ok) {
            logger.error('campaign.index.metadata_unavailable', {
              campaignSlug,
              reason: titleResult.reason,
            });

            return createUnavailableCampaign({ campaignSlug, title: 'Campaign temporarily unavailable', gate });
          }

          return {
            slug: campaignSlug,
            href: `/campaigns/${campaignSlug}`,
            title: titleResult.title,
            gate,
            gateSource: 'registry',
            isAvailable: true,
          };
        } catch (error) {
          logger.error('campaign.index.metadata_unavailable', {
            campaignSlug,
            reason: 'loaderRejected',
            message: error instanceof Error ? error.message : 'unknown error',
          });

          return createUnavailableCampaign({ campaignSlug, title: 'Campaign temporarily unavailable', gate });
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
