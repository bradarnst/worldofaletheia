import { type CampaignMembershipRepo, createCampaignMembershipRepoFromLocals } from '~/lib/campaign-membership-repo';
import { getRequestSession, type RequestSession } from '~/lib/auth-session';
import {
  normalizeCampaignMembershipConfig,
  normalizeCampaignMembershipEntries,
  type CampaignMembershipRole,
} from '@utils/campaign-membership-config';

export type CampaignVisibility = 'public' | 'campaignMembers' | 'gm';

type CampaignAccessConfig = Record<string, { visibility?: CampaignVisibility }>;

const DEFAULT_SESSION_COOKIE = 'aletheia-dev-session';

function parseMembershipConfig(rawConfig: string | undefined): Map<string, Map<string, CampaignMembershipRole>> {
  if (!rawConfig) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    const membershipConfig =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('memberships' in parsed || 'gmAssignments' in parsed)
        ? normalizeCampaignMembershipConfig(parsed).memberships
        : normalizeCampaignMembershipEntries(parsed);
    const bySession = new Map<string, Map<string, CampaignMembershipRole>>();

    for (const [sessionId, value] of Object.entries(membershipConfig)) {
      bySession.set(sessionId, new Map(Object.entries(value.campaigns)));
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
  allowLegacyEnvFallback?: boolean;
}): AsyncCampaignAccessResolver {
  const { request, locals, membershipConfigRaw, allowLegacyEnvFallback = false } = options;
  const legacyResolver = createCampaignAccessResolver({
    cookieHeader: request.headers.get('cookie'),
    membershipConfigRaw,
  });

  let resolvedSessionPromise: Promise<RequestSession | null> | null = null;
  let repoPromise: Promise<CampaignMembershipRepo> | null = null;
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

        try {
          if (!repoPromise) {
            repoPromise = createCampaignMembershipRepoFromLocals(locals);
          }

          const repo = await repoPromise;
          const [isMember, isGm] = await Promise.all([
            repo.isUserMemberOfCampaign(session.user.id, campaignSlug),
            repo.isUserGmOfCampaign(session.user.id, campaignSlug),
          ]);

          return {
            isMember,
            isGm,
          };
        } catch (error) {
          console.error('campaign.membership.lookup_failed', {
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
  campaignAccessConfigRaw?: string | undefined;
  cookieName?: string;
}): CampaignAccessResolver {
  const { cookieHeader, membershipConfigRaw, campaignAccessConfigRaw, cookieName = DEFAULT_SESSION_COOKIE } = options;
  const sessionId = readCookieValue(cookieHeader, cookieName);
  const membershipsBySession = parseMembershipConfig(membershipConfigRaw);
  const campaignVisibilityBySlug = parseCampaignAccessConfig(campaignAccessConfigRaw);

  return {
    hasCampaignAccess(campaignSlug: string): boolean {
      if (!sessionId) {
        return false;
      }

      const campaignsBySlug = membershipsBySession.get(sessionId);
      if (!campaignsBySlug) {
        return false;
      }

      const role = campaignsBySlug.get(campaignSlug);
      return role === 'member' || role === 'gm';
    },
    isCampaignGm(campaignSlug: string): boolean {
      if (!sessionId) {
        return false;
      }

      const campaignsBySlug = membershipsBySession.get(sessionId);
      if (!campaignsBySlug) {
        return false;
      }

      return campaignsBySlug.get(campaignSlug) === 'gm';
    },
    getCampaignVisibility(campaignSlug: string): CampaignVisibility | null {
      return campaignVisibilityBySlug.get(campaignSlug) ?? null;
    },
  };
}
