import membershipConfigJson from '../../config/campaign-access.config.json';

export type CampaignMembershipRole = 'member' | 'gm';

export interface CampaignMembershipConfigEntry {
  campaigns: Record<string, CampaignMembershipRole>;
}

export interface CampaignMembershipConfig {
  memberships: Record<string, CampaignMembershipConfigEntry>;
}

const EMPTY_CONFIG: CampaignMembershipConfig = { memberships: {} };

function isCampaignMembershipRole(value: unknown): value is CampaignMembershipRole {
  return value === 'member' || value === 'gm';
}

export function normalizeCampaignMembershipEntries(
  rawMemberships: unknown,
): Record<string, CampaignMembershipConfigEntry> {
  if (!rawMemberships || typeof rawMemberships !== 'object' || Array.isArray(rawMemberships)) {
    return {};
  }

  const memberships: Record<string, CampaignMembershipConfigEntry> = {};

  for (const [userId, entry] of Object.entries(rawMemberships)) {
    if (!userId || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const campaignsRaw = (entry as { campaigns?: unknown }).campaigns;
    const campaigns: Record<string, CampaignMembershipRole> = {};

    if (Array.isArray(campaignsRaw)) {
      for (const campaignSlug of campaignsRaw) {
        if (typeof campaignSlug !== 'string' || campaignSlug.length === 0) {
          continue;
        }

        campaigns[campaignSlug] = 'member';
      }
    } else if (campaignsRaw && typeof campaignsRaw === 'object' && !Array.isArray(campaignsRaw)) {
      for (const [campaignSlug, role] of Object.entries(campaignsRaw)) {
        if (!campaignSlug || !isCampaignMembershipRole(role)) {
          continue;
        }

        campaigns[campaignSlug] = role;
      }
    }

    if (Object.keys(campaigns).length === 0) {
      continue;
    }

    memberships[userId] = { campaigns };
  }

  return memberships;
}

export function normalizeCampaignMembershipConfig(rawConfig: unknown): CampaignMembershipConfig {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return EMPTY_CONFIG;
  }

  const configObject = rawConfig as {
    memberships?: unknown;
    gmAssignments?: unknown;
  };
  const memberships = normalizeCampaignMembershipEntries(configObject.memberships);

  if (configObject.gmAssignments && typeof configObject.gmAssignments === 'object' && !Array.isArray(configObject.gmAssignments)) {
    for (const [campaignSlug, value] of Object.entries(configObject.gmAssignments)) {
      if (!campaignSlug || !value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      const userId = (value as { userId?: unknown }).userId;
      if (typeof userId !== 'string' || userId.length === 0) {
        continue;
      }

      const existingEntry = memberships[userId] ?? { campaigns: {} };
      memberships[userId] = {
        campaigns: {
          ...existingEntry.campaigns,
          [campaignSlug]: 'gm',
        },
      };
    }
  }

  return { memberships };
}

export function getCampaignMembershipConfigForEnv(): string {
  const normalized = normalizeCampaignMembershipConfig(membershipConfigJson);
  return JSON.stringify(normalized.memberships);
}
