import { type CampaignMembershipRepo, createCampaignMembershipRepoFromLocals } from '~/lib/campaign-membership-repo';
import { getRequestSession, type RequestSession } from '~/lib/auth-session';

export type CampaignVisibility = 'public' | 'campaignMembers' | 'gm';

interface MembershipEntry {
  campaigns?: string[];
}

type MembershipConfig = Record<string, MembershipEntry>;
type GmAssignmentsConfig = Record<string, { userId?: string }>;
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

      if (value.visibility === 'public' || value.visibility === 'campaignMembers' || value.visibility === 'gm') {
        byCampaign.set(slug, value.visibility);
      }
    }

    return byCampaign;
  } catch {
    return new Map();
  }
}

function parseGmAssignments(rawConfig: string | undefined): Map<string, string> {
  if (!rawConfig) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    const byCampaign = new Map<string, string>();
    for (const [campaignSlug, value] of Object.entries(parsed as GmAssignmentsConfig)) {
      if (!campaignSlug || !value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      const userId = value.userId;
      if (typeof userId === 'string' && userId.length > 0) {
        byCampaign.set(campaignSlug, userId);
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

export function resolveCampaignContentVisibility(input: {
  campaignSlug: string;
  contentVisibility: CampaignVisibility;
  campaignVisibility?: CampaignVisibility | null;
}): CampaignVisibility {
  if (input.contentVisibility === 'gm') {
    console.info('campaign.visibility.resolve', {
      campaignSlug: input.campaignSlug,
      contentVisibility: input.contentVisibility,
      campaignVisibility: input.campaignVisibility ?? null,
      effectiveVisibility: 'gm',
      reason: 'content-explicit-gm',
    });
    return 'gm';
  }

  if (input.contentVisibility === 'campaignMembers') {
    console.info('campaign.visibility.resolve', {
      campaignSlug: input.campaignSlug,
      contentVisibility: input.contentVisibility,
      campaignVisibility: input.campaignVisibility ?? null,
      effectiveVisibility: 'campaignMembers',
      reason: 'content-explicit-campaignMembers',
    });
    return 'campaignMembers';
  }

  if (input.campaignVisibility === 'gm') {
    console.info('campaign.visibility.resolve', {
      campaignSlug: input.campaignSlug,
      contentVisibility: input.contentVisibility,
      campaignVisibility: input.campaignVisibility,
      effectiveVisibility: 'gm',
      reason: 'campaign-default-tighten-to-gm',
    });
    return 'gm';
  }

  const effectiveVisibility = input.campaignVisibility === 'campaignMembers' ? 'campaignMembers' : 'public';
  console.info('campaign.visibility.resolve', {
    campaignSlug: input.campaignSlug,
    contentVisibility: input.contentVisibility,
    campaignVisibility: input.campaignVisibility ?? null,
    effectiveVisibility,
    reason:
      input.campaignVisibility === 'campaignMembers'
        ? 'campaign-default-tighten-to-campaignMembers'
        : 'content-or-default-public',
  });

  return effectiveVisibility;
}

export interface CampaignAccessResolver {
  hasCampaignAccess(campaignSlug: string): boolean;
  isCampaignGm(campaignSlug: string): boolean;
  getCampaignGmUserId(campaignSlug: string): string | null;
  getCampaignVisibility(campaignSlug: string): CampaignVisibility | null;
}

interface AsyncCampaignAccessResolver {
  hasCampaignAccess(campaignSlug: string): Promise<{ isMember: boolean; isGm: boolean }>;
}

/**
 * Phase 2 local/dev auth gate.
 * Visibility is enforced only for campaign-domain content.
 */
export function canViewCampaignContent(input: CampaignAccessInput): boolean {
  const { visibility, campaignSlug, access } = input;

  if (visibility === 'public') {
    console.info('campaign.access.decision', {
      campaignSlug,
      visibility,
      allowed: true,
      reason: 'public',
    });
    return true;
  }

  if (visibility === 'gm') {
    const allowed = access.isCampaignGm(campaignSlug);
    console.info('campaign.access.decision', {
      campaignSlug,
      visibility,
      allowed,
      reason: allowed ? 'gm-allowed' : 'gm-denied',
    });
    return allowed;
  }

  const allowed = access.hasCampaignAccess(campaignSlug);
  console.info('campaign.access.decision', {
    campaignSlug,
    visibility,
    allowed,
    reason: allowed ? 'member-allowed' : 'member-denied',
  });
  return allowed;
}

export function getCampaignContentVisibility(input: {
  campaignSlug: string;
  contentVisibility: CampaignVisibility;
  access: CampaignAccessResolver;
}): CampaignVisibility {
  const campaignVisibility = input.access.getCampaignVisibility(input.campaignSlug);
  return resolveCampaignContentVisibility({
    campaignSlug: input.campaignSlug,
    contentVisibility: input.contentVisibility,
    campaignVisibility,
  });
}

export async function canViewCampaignContentAsync(input: {
  visibility: CampaignVisibility;
  campaignSlug: string;
  access: AsyncCampaignAccessResolver;
}): Promise<boolean> {
  if (input.visibility === 'public') {
    console.info('campaign.access.decision.async', {
      campaignSlug: input.campaignSlug,
      visibility: input.visibility,
      allowed: true,
      reason: 'public',
    });
    return true;
  }

  const accessResult = await input.access.hasCampaignAccess(input.campaignSlug);

  if (input.visibility === 'gm') {
    const allowed = accessResult.isGm;
    console.info('campaign.access.decision.async', {
      campaignSlug: input.campaignSlug,
      visibility: input.visibility,
      allowed,
      reason: allowed ? 'gm-allowed' : 'gm-denied',
      accessResult,
    });
    return allowed;
  }

  const allowed = accessResult.isMember || accessResult.isGm;
  console.info('campaign.access.decision.async', {
    campaignSlug: input.campaignSlug,
    visibility: input.visibility,
    allowed,
    reason: allowed ? 'member-or-gm-allowed' : 'member-or-gm-denied',
    accessResult,
  });
  return allowed;
}

export function createCampaignAccessResolverFromRequest(options: {
  request: Request;
  locals: unknown;
  membershipConfigRaw: string | undefined;
  gmAssignmentsConfigRaw?: string | undefined;
  allowLegacyEnvFallback?: boolean;
}): AsyncCampaignAccessResolver {
  const {
    request,
    locals,
    membershipConfigRaw,
    gmAssignmentsConfigRaw,
    allowLegacyEnvFallback = false,
  } = options;
  const legacyResolver = createCampaignAccessResolver({
    cookieHeader: request.headers.get('cookie'),
    membershipConfigRaw,
    gmAssignmentsConfigRaw,
  });

  let resolvedSessionPromise: Promise<RequestSession | null> | null = null;
  const membershipByCampaign = new Map<string, Promise<{ isMember: boolean; isGm: boolean }>>();

  return {
    async hasCampaignAccess(campaignSlug: string): Promise<{ isMember: boolean; isGm: boolean }> {
      const existing = membershipByCampaign.get(campaignSlug);
      if (existing) {
        return existing;
      }

      const decision = (async () => {
        if (!resolvedSessionPromise) {
          resolvedSessionPromise = getRequestSession(request, locals);
        }

        const session = await resolvedSessionPromise;
        if (!session) {
          if (!allowLegacyEnvFallback) {
            return { isMember: false, isGm: false };
          }

          return {
            isMember: legacyResolver.hasCampaignAccess(campaignSlug),
            isGm: legacyResolver.isCampaignGm(campaignSlug),
          };
        }

        let repo: CampaignMembershipRepo;
        let isMember = false;
        try {
          repo = await createCampaignMembershipRepoFromLocals(locals);
          isMember = await repo.isUserMemberOfCampaign(session.user.id, campaignSlug);
        } catch (error) {
          console.error('campaign.membership.query_failed', {
            message: error instanceof Error ? error.message : 'unknown error',
            campaignSlug,
          });
          if (!allowLegacyEnvFallback) {
            return { isMember: false, isGm: false };
          }

          return {
            isMember: legacyResolver.hasCampaignAccess(campaignSlug),
            isGm: legacyResolver.isCampaignGm(campaignSlug),
          };
        }

        try {
          const isGm = await repo.isUserGmOfCampaign(session.user.id, campaignSlug);

          return {
            isMember,
            isGm,
          };
        } catch (error) {
          console.error('campaign.gm.query_failed', {
            message: error instanceof Error ? error.message : 'unknown error',
            campaignSlug,
          });
          if (!allowLegacyEnvFallback) {
            return { isMember: false, isGm: false };
          }

          return {
            isMember: legacyResolver.hasCampaignAccess(campaignSlug),
            isGm: legacyResolver.isCampaignGm(campaignSlug),
          };
        }
      })();

      membershipByCampaign.set(campaignSlug, decision);
      return decision;
    },
  };
}

export function createCampaignAccessResolver(options: {
  cookieHeader: string | null | undefined;
  membershipConfigRaw: string | undefined;
  gmAssignmentsConfigRaw?: string | undefined;
  campaignAccessConfigRaw?: string | undefined;
  cookieName?: string;
}): CampaignAccessResolver {
  const {
    cookieHeader,
    membershipConfigRaw,
    gmAssignmentsConfigRaw,
    campaignAccessConfigRaw,
    cookieName = DEFAULT_SESSION_COOKIE,
  } = options;
  const sessionId = readCookieValue(cookieHeader, cookieName);
  const membershipsBySession = parseMembershipConfig(membershipConfigRaw);
  const gmByCampaign = parseGmAssignments(gmAssignmentsConfigRaw);
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
    isCampaignGm(campaignSlug: string): boolean {
      if (!sessionId) {
        return false;
      }

      return gmByCampaign.get(campaignSlug) === sessionId;
    },
    getCampaignGmUserId(campaignSlug: string): string | null {
      return gmByCampaign.get(campaignSlug) ?? null;
    },
    getCampaignVisibility(campaignSlug: string): CampaignVisibility | null {
      return campaignVisibilityBySlug.get(campaignSlug) ?? null;
    },
  };
}
