import { createCampaignMembershipRepoFromLocals } from '../lib/campaign-membership-repo';
import { getRequestSession, type RequestSession } from '../lib/auth-session';

export type CampaignVisibility = 'public' | 'campaignMembers';

interface MembershipEntry {
  campaigns?: string[];
}

type MembershipConfig = Record<string, MembershipEntry>;
type CampaignAccessConfig = Record<string, { visibility?: CampaignVisibility }>;

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

function parseCampaignAccessConfig(rawConfig: string | undefined): Map<string, CampaignVisibility> {
  if (!rawConfig) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    const campaigns = (parsed as { campaigns?: unknown }).campaigns;
    if (!campaigns || typeof campaigns !== 'object' || Array.isArray(campaigns)) {
      return new Map();
    }

    const byCampaign = new Map<string, CampaignVisibility>();
    for (const [slug, value] of Object.entries(campaigns as CampaignAccessConfig)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      if (value.visibility === 'public' || value.visibility === 'campaignMembers') {
        byCampaign.set(slug, value.visibility);
      }
    }

    return byCampaign;
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
  getCampaignVisibility(campaignSlug: string): CampaignVisibility | null;
}

interface AsyncCampaignAccessResolver {
  hasCampaignAccess(campaignSlug: string): Promise<boolean>;
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

export function getCampaignContentVisibility(input: {
  campaignSlug: string;
  contentVisibility: CampaignVisibility;
  access: CampaignAccessResolver;
}): CampaignVisibility {
  if (input.contentVisibility === 'campaignMembers') {
    return 'campaignMembers';
  }

  const campaignVisibility = input.access.getCampaignVisibility(input.campaignSlug);
  return campaignVisibility === 'campaignMembers' ? 'campaignMembers' : 'public';
}

export async function canViewCampaignContentAsync(input: {
  visibility: CampaignVisibility;
  campaignSlug: string;
  access: AsyncCampaignAccessResolver;
}): Promise<boolean> {
  if (input.visibility === 'public') {
    return true;
  }

  return input.access.hasCampaignAccess(input.campaignSlug);
}

export function createCampaignAccessResolverFromRequest(options: {
  request: Request;
  locals: unknown;
  membershipConfigRaw: string | undefined;
  allowLegacyEnvFallback?: boolean;
}): AsyncCampaignAccessResolver {
  const { request, locals, membershipConfigRaw, allowLegacyEnvFallback = false } = options;
  const legacyResolver = createCampaignAccessResolver({
    cookieHeader: request.headers.get('cookie'),
    membershipConfigRaw,
  });

  let resolvedSessionPromise: Promise<RequestSession | null> | null = null;

  return {
    async hasCampaignAccess(campaignSlug: string): Promise<boolean> {
      if (!resolvedSessionPromise) {
        resolvedSessionPromise = getRequestSession(request, locals);
      }

      const session = await resolvedSessionPromise;
      if (!session) {
        return allowLegacyEnvFallback ? legacyResolver.hasCampaignAccess(campaignSlug) : false;
      }

      try {
        const repo = createCampaignMembershipRepoFromLocals(locals);
        return await repo.isUserMemberOfCampaign(session.user.id, campaignSlug);
      } catch (error) {
        console.error('campaign.membership.query_failed', {
          message: error instanceof Error ? error.message : 'unknown error',
          campaignSlug,
        });
        return allowLegacyEnvFallback ? legacyResolver.hasCampaignAccess(campaignSlug) : false;
      }
    },
  };
}

export function createCampaignAccessResolver(options: {
  cookieHeader: string | null | undefined;
  membershipConfigRaw: string | undefined;
  campaignAccessConfigRaw?: string | undefined;
  cookieName?: string;
}): CampaignAccessResolver {
  const {
    cookieHeader,
    membershipConfigRaw,
    campaignAccessConfigRaw,
    cookieName = DEFAULT_SESSION_COOKIE,
  } = options;
  const sessionId = readCookieValue(cookieHeader, cookieName);
  const membershipsBySession = parseMembershipConfig(membershipConfigRaw);
  const campaignVisibilityBySlug = parseCampaignAccessConfig(campaignAccessConfigRaw);

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
    getCampaignVisibility(campaignSlug: string): CampaignVisibility | null {
      return campaignVisibilityBySlug.get(campaignSlug) ?? null;
    },
  };
}
