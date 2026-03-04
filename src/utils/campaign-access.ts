export type CampaignVisibility = 'public' | 'campaignMembers';

interface MembershipEntry {
  campaigns?: string[];
}

type MembershipConfig = Record<string, MembershipEntry>;

const DEFAULT_SESSION_COOKIE = 'aletheia-dev-session';

function parseMembershipConfig(rawConfig: string | undefined): Map<string, Set<string>> {
  if (!rawConfig) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    const membershipConfig = parsed as MembershipConfig;
    const bySession = new Map<string, Set<string>>();

    for (const [sessionId, value] of Object.entries(membershipConfig)) {
      const campaigns = Array.isArray(value?.campaigns)
        ? value.campaigns.filter((campaign): campaign is string => typeof campaign === 'string' && campaign.length > 0)
        : [];

      bySession.set(sessionId, new Set(campaigns));
    }

    return bySession;
  } catch {
    return new Map();
  }
}

function safeDecodeCookieValue(rawValue: string): string | null {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return null;
  }
}

function readCookieValue(cookieHeader: string | null | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookiePart of cookies) {
    const trimmed = cookiePart.trim();
    const prefix = `${cookieName}=`;
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length);
      const decoded = safeDecodeCookieValue(value);
      if (!decoded) {
        return null;
      }

      return decoded;
    }
  }

  return null;
}

export interface CampaignAccessInput {
  visibility: CampaignVisibility;
  campaignSlug: string;
  access: CampaignAccessResolver;
}

export interface CampaignAccessResolver {
  hasCampaignAccess(campaignSlug: string): boolean;
}

/**
 * Phase 2 local/dev auth gate.
 * Visibility is enforced only for campaign-domain content.
 */
export function canViewCampaignContent(input: CampaignAccessInput): boolean {
  const { visibility, campaignSlug, access } = input;

  if (visibility === 'public') {
    return true;
  }

  return access.hasCampaignAccess(campaignSlug);
}

export function createCampaignAccessResolver(options: {
  cookieHeader: string | null | undefined;
  membershipConfigRaw: string | undefined;
  cookieName?: string;
}): CampaignAccessResolver {
  const { cookieHeader, membershipConfigRaw, cookieName = DEFAULT_SESSION_COOKIE } = options;
  const sessionId = readCookieValue(cookieHeader, cookieName);
  const membershipsBySession = parseMembershipConfig(membershipConfigRaw);

  return {
    hasCampaignAccess(campaignSlug: string): boolean {
      if (!sessionId) {
        return false;
      }

      const campaigns = membershipsBySession.get(sessionId);
      if (!campaigns) {
        return false;
      }

      return campaigns.has(campaignSlug);
    },
  };
}
