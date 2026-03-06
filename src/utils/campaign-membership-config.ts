import membershipConfigJson from '../content/campaigns/access.config.json';

interface MembershipEntry {
  campaigns: string[];
}

interface GmAssignmentEntry {
  userId: string;
}

export interface CampaignMembershipConfig {
  memberships: Record<string, MembershipEntry>;
  gmAssignments: Record<string, GmAssignmentEntry>;
}

const EMPTY_CONFIG: CampaignMembershipConfig = { memberships: {}, gmAssignments: {} };

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

  const gmAssignmentsRaw = (rawConfig as { gmAssignments?: unknown }).gmAssignments;
  const gmAssignments: Record<string, GmAssignmentEntry> = {};
  if (gmAssignmentsRaw && typeof gmAssignmentsRaw === 'object' && !Array.isArray(gmAssignmentsRaw)) {
    for (const [campaignSlug, value] of Object.entries(gmAssignmentsRaw)) {
      if (!campaignSlug || !value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      const userId = (value as { userId?: unknown }).userId;
      if (typeof userId !== 'string' || userId.length === 0) {
        continue;
      }

      gmAssignments[campaignSlug] = { userId };
    }
  }

  return { memberships, gmAssignments };
}

export function getCampaignMembershipConfigForEnv(): string {
  const normalized = normalizeCampaignMembershipConfig(membershipConfigJson);
  return JSON.stringify(normalized.memberships);
}

export function getCampaignGmAssignmentsForEnv(): string {
  const normalized = normalizeCampaignMembershipConfig(membershipConfigJson);
  return JSON.stringify(normalized.gmAssignments);
}
