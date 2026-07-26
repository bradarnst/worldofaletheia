import { type CampaignMembershipRepo, createCampaignMembershipRepoFromLocals } from '~/lib/campaign-membership-repo';
import { getRequestSession, type RequestSession } from '~/lib/auth-session';
import {
  normalizeCampaignMembershipEntries,
  type CampaignMembershipRole,
} from '@utils/campaign-membership-config';

const DEFAULT_SESSION_COOKIE = 'aletheia-dev-session';

export interface CampaignAccessDecision {
  isMember: boolean;
  isGm: boolean;
}

export interface CampaignAccessResolver {
  hasCampaignAccess(campaignSlug: string): Promise<CampaignAccessDecision>;
}

function parseMembershipConfig(rawConfig: string | undefined): Map<string, Map<string, CampaignMembershipRole>> {
  if (!rawConfig) {
    return new Map();
  }

  try {
    const parsed: unknown = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    const membershipConfig = 'memberships' in parsed
      ? normalizeCampaignMembershipEntries((parsed as { memberships?: unknown }).memberships)
      : normalizeCampaignMembershipEntries(parsed);

    return new Map(
      Object.entries(membershipConfig).map(([sessionId, value]) => [
        sessionId,
        new Map(Object.entries(value.campaigns)),
      ]),
    );
  } catch {
    return new Map();
  }
}

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${cookieName}=`;
  const encodedValue = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);

  if (!encodedValue) {
    return null;
  }

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return null;
  }
}

function getLocalMembership(options: {
  cookieHeader: string | null;
  membershipConfigRaw: string | undefined;
  campaignSlug: string;
}): CampaignAccessDecision {
  const sessionId = readCookieValue(options.cookieHeader, DEFAULT_SESSION_COOKIE);
  const role = sessionId
    ? parseMembershipConfig(options.membershipConfigRaw).get(sessionId)?.get(options.campaignSlug)
    : undefined;

  return {
    isMember: role === 'member' || role === 'gm',
    isGm: role === 'gm',
  };
}

export function createCampaignAccessResolverFromRequest(options: {
  request: Request;
  locals: unknown;
  membershipConfigRaw: string | undefined;
  allowLegacyEnvFallback?: boolean;
}): CampaignAccessResolver {
  const { request, locals, membershipConfigRaw, allowLegacyEnvFallback = false } = options;
  let resolvedSessionPromise: Promise<RequestSession | null> | null = null;
  let repoPromise: Promise<CampaignMembershipRepo> | null = null;
  const membershipByCampaign = new Map<string, Promise<CampaignAccessDecision>>();

  const getFallback = (campaignSlug: string) => getLocalMembership({
    cookieHeader: request.headers.get('cookie'),
    membershipConfigRaw,
    campaignSlug,
  });

  return {
    async hasCampaignAccess(campaignSlug: string): Promise<CampaignAccessDecision> {
      const cachedDecision = membershipByCampaign.get(campaignSlug);
      if (cachedDecision) {
        return cachedDecision;
      }

      const decision = (async () => {
        resolvedSessionPromise ??= getRequestSession(request, locals);
        const session = await resolvedSessionPromise;

        if (!session) {
          return allowLegacyEnvFallback
            ? getFallback(campaignSlug)
            : { isMember: false, isGm: false };
        }

        try {
          repoPromise ??= createCampaignMembershipRepoFromLocals(locals);
          const repo = await repoPromise;
          const [isMember, isGm] = await Promise.all([
            repo.isUserMemberOfCampaign(session.user.id, campaignSlug),
            repo.isUserGmOfCampaign(session.user.id, campaignSlug),
          ]);

          return { isMember, isGm };
        } catch (error) {
          console.error('campaign.membership.lookup_failed', {
            message: error instanceof Error ? error.message : 'unknown error',
            campaignSlug,
          });
          return allowLegacyEnvFallback
            ? getFallback(campaignSlug)
            : { isMember: false, isGm: false };
        }
      })();

      membershipByCampaign.set(campaignSlug, decision);
      return decision;
    },
  };
}
