import membershipConfigJson from '../content/campaigns/access.config.json';

interface MembershipEntry {
  campaigns: string[];
}

export interface CampaignMembershipConfig {
  memberships: Record<string, MembershipEntry>;
}

const EMPTY_CONFIG: CampaignMembershipConfig = { memberships: {} };

export function normalizeCampaignMembershipConfig(rawConfig: unknown): CampaignMembershipConfig {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return EMPTY_CONFIG;
  }

  const candidate = rawConfig as { memberships?: unknown };
  if (!candidate.memberships || typeof candidate.memberships !== 'object' || Array.isArray(candidate.memberships)) {
    return EMPTY_CONFIG;
  }

  const memberships: Record<string, MembershipEntry> = {};

  for (const [userId, entry] of Object.entries(candidate.memberships)) {
    if (!userId || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const campaignsRaw = (entry as { campaigns?: unknown }).campaigns;
    if (!Array.isArray(campaignsRaw)) {
      continue;
    }

    const campaigns = campaignsRaw.filter(
      (campaign): campaign is string => typeof campaign === 'string' && campaign.length > 0,
    );

    memberships[userId] = { campaigns };
  }

  return { memberships };
}

export function getCampaignMembershipConfigForEnv(): string {
  const normalized = normalizeCampaignMembershipConfig(membershipConfigJson);
  return JSON.stringify(normalized.memberships);
}

