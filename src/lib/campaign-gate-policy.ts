export type CampaignGate = 'public' | 'campaignMembers';
export type ContentVisibility = 'public' | 'campaignMembers' | 'gm';
export type CampaignAccessRole = 'anonymous' | 'member' | 'gm';

export type CampaignGateSource = 'manifest' | 'invalid-default' | 'missing-default';

export interface CampaignGateLogger {
  warn(event: string, details: Record<string, unknown>): void;
  error(event: string, details: Record<string, unknown>): void;
}

export interface ParsedCampaignGateManifest {
  entries: Record<string, CampaignGate>;
  sources: Record<string, Exclude<CampaignGateSource, 'missing-default'>>;
}

export interface ResolvedCampaignGate {
  campaignSlug: string;
  gate: CampaignGate;
  source: CampaignGateSource;
}

export interface CampaignGateAccessDecision {
  campaignSlug: string;
  gate: CampaignGate;
  gateSource: CampaignGateSource;
  campaignAccessRole: CampaignAccessRole;
  allowedVisibilities: ContentVisibility[];
  gateAllowsRequest: boolean;
  mayFetchSource: boolean;
  reason: 'public_gate_allowed' | 'campaign_member_allowed' | 'campaign_gm_allowed' | 'campaign_membership_required';
}

export const CAMPAIGN_GATE_MANIFEST = {
  brad: 'campaignMembers',
  barry: 'campaignMembers',
  'sample-campaign': 'public',
} as const satisfies Record<string, CampaignGate>;

const FALLBACK_GATE: CampaignGate = 'campaignMembers';
const defaultLogger: CampaignGateLogger = console;
const allowedVisibilitiesByAccessRole: Record<CampaignAccessRole, ContentVisibility[]> = {
  anonymous: ['public'],
  member: ['public', 'campaignMembers'],
  gm: ['public', 'campaignMembers', 'gm'],
};

function isCampaignGate(value: unknown): value is CampaignGate {
  return value === 'public' || value === 'campaignMembers';
}

function normalizeCampaignSlug(slug: string): string {
  return slug.trim();
}

export function parseCampaignGateManifest(
  rawManifest: Record<string, unknown>,
  options: { logger?: CampaignGateLogger } = {},
): ParsedCampaignGateManifest {
  const logger = options.logger ?? defaultLogger;
  const entries: Record<string, CampaignGate> = {};
  const sources: Record<string, Exclude<CampaignGateSource, 'missing-default'>> = {};

  for (const [rawSlug, value] of Object.entries(rawManifest)) {
    const campaignSlug = normalizeCampaignSlug(rawSlug);
    if (!campaignSlug) {
      logger.error('campaign.gate_manifest.invalid_slug', {
        campaignSlug: rawSlug,
        fallbackGate: FALLBACK_GATE,
      });
      continue;
    }

    if (isCampaignGate(value)) {
      entries[campaignSlug] = value;
      sources[campaignSlug] = 'manifest';
      continue;
    }

    entries[campaignSlug] = FALLBACK_GATE;
    sources[campaignSlug] = 'invalid-default';
    logger.error('campaign.gate_manifest.invalid_value', {
      campaignSlug,
      value,
      fallbackGate: FALLBACK_GATE,
    });
  }

  return { entries, sources };
}

export function getCampaignGate(
  campaignSlug: string,
  manifest: ParsedCampaignGateManifest,
  options: { logger?: CampaignGateLogger } = {},
): ResolvedCampaignGate {
  const normalizedSlug = normalizeCampaignSlug(campaignSlug);
  const gate = manifest.entries[normalizedSlug];

  if (gate) {
    return {
      campaignSlug: normalizedSlug,
      gate,
      source: manifest.sources[normalizedSlug] ?? 'manifest',
    };
  }

  const logger = options.logger ?? defaultLogger;
  logger.warn('campaign.gate_manifest.missing_entry', {
    campaignSlug: normalizedSlug,
    fallbackGate: FALLBACK_GATE,
  });

  return {
    campaignSlug: normalizedSlug,
    gate: FALLBACK_GATE,
    source: 'missing-default',
  };
}

export function deriveAllowedContentVisibilities(input: {
  gate: CampaignGate;
  campaignAccessRole: CampaignAccessRole;
}): ContentVisibility[] {
  if (input.gate === 'campaignMembers' && input.campaignAccessRole === 'anonymous') {
    return [];
  }

  return [...allowedVisibilitiesByAccessRole[input.campaignAccessRole]];
}

function getDecisionReason(input: {
  gate: CampaignGate;
  campaignAccessRole: CampaignAccessRole;
  gateAllowsRequest: boolean;
}): CampaignGateAccessDecision['reason'] {
  if (!input.gateAllowsRequest) {
    return 'campaign_membership_required';
  }

  if (input.campaignAccessRole === 'gm') {
    return 'campaign_gm_allowed';
  }

  if (input.campaignAccessRole === 'member') {
    return 'campaign_member_allowed';
  }

  return 'public_gate_allowed';
}

export function decideCampaignGateAccess(input: {
  campaignSlug: string;
  manifest: ParsedCampaignGateManifest;
  campaignAccessRole: CampaignAccessRole;
  logger?: CampaignGateLogger;
}): CampaignGateAccessDecision {
  const resolvedGate = getCampaignGate(input.campaignSlug, input.manifest, { logger: input.logger });
  const allowedVisibilities = deriveAllowedContentVisibilities({
    gate: resolvedGate.gate,
    campaignAccessRole: input.campaignAccessRole,
  });
  const gateAllowsRequest = allowedVisibilities.length > 0;

  return {
    campaignSlug: resolvedGate.campaignSlug,
    gate: resolvedGate.gate,
    gateSource: resolvedGate.source,
    campaignAccessRole: input.campaignAccessRole,
    allowedVisibilities,
    gateAllowsRequest,
    mayFetchSource: gateAllowsRequest,
    reason: getDecisionReason({
      gate: resolvedGate.gate,
      campaignAccessRole: input.campaignAccessRole,
      gateAllowsRequest,
    }),
  };
}

export const campaignGateManifest = parseCampaignGateManifest(CAMPAIGN_GATE_MANIFEST);
