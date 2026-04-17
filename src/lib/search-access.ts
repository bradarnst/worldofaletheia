import { getRequestSession } from './auth-session';
import { createCampaignMembershipRepoFromLocals } from './campaign-membership-repo';
import type { ContentIndexCampaignVisibilityAccess } from './content-index-repo';

type SearchScopeReason =
  | 'guest'
  | 'authenticated_no_memberships'
  | 'authenticated_member_access'
  | 'authenticated_gm_access'
  | 'authorization_unavailable';

export interface SearchResponseScope {
  isAuthenticated: boolean;
  visibility: 'public' | 'campaignMembers' | 'gm';
  reason: SearchScopeReason;
  campaignAccess: {
    membershipCount: number;
    gmCount: number;
  };
}

export interface ResolvedSearchAccess {
  responseScope: SearchResponseScope;
  visibilityAccess?: ContentIndexCampaignVisibilityAccess;
}

function createScope(input: {
  isAuthenticated: boolean;
  visibility: 'public' | 'campaignMembers' | 'gm';
  reason: SearchScopeReason;
  membershipCount?: number;
  gmCount?: number;
}): SearchResponseScope {
  return {
    isAuthenticated: input.isAuthenticated,
    visibility: input.visibility,
    reason: input.reason,
    campaignAccess: {
      membershipCount: input.membershipCount ?? 0,
      gmCount: input.gmCount ?? 0,
    },
  };
}

function normalizeCampaignSlugs(slugs: string[]): string[] {
  return [...new Set(slugs.map((slug) => slug.trim()).filter((slug) => slug.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export async function resolveSearchAccess(request: Request, locals: unknown): Promise<ResolvedSearchAccess> {
  const session = await getRequestSession(request, locals);
  if (!session) {
    return {
      responseScope: createScope({
        isAuthenticated: false,
        visibility: 'public',
        reason: 'guest',
      }),
    };
  }

  try {
    const repo = await createCampaignMembershipRepoFromLocals(locals);
    const memberships = await repo.listUserCampaignAccess(session.user.id);
    const gmCampaignSlugs = normalizeCampaignSlugs(
      memberships.filter((membership) => membership.role === 'gm').map((membership) => membership.campaignSlug),
    );
    const memberCampaignSlugs = normalizeCampaignSlugs(memberships.map((membership) => membership.campaignSlug));

    if (gmCampaignSlugs.length > 0) {
      return {
        responseScope: createScope({
          isAuthenticated: true,
          visibility: 'gm',
          reason: 'authenticated_gm_access',
          membershipCount: memberCampaignSlugs.length,
          gmCount: gmCampaignSlugs.length,
        }),
        visibilityAccess: {
          memberCampaignSlugs,
          gmCampaignSlugs,
        },
      };
    }

    if (memberCampaignSlugs.length > 0) {
      return {
        responseScope: createScope({
          isAuthenticated: true,
          visibility: 'campaignMembers',
          reason: 'authenticated_member_access',
          membershipCount: memberCampaignSlugs.length,
          gmCount: 0,
        }),
        visibilityAccess: {
          memberCampaignSlugs,
          gmCampaignSlugs: [],
        },
      };
    }

    return {
      responseScope: createScope({
        isAuthenticated: true,
        visibility: 'public',
        reason: 'authenticated_no_memberships',
      }),
    };
  } catch (error) {
    console.error('search.access.resolve_failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return {
      responseScope: createScope({
        isAuthenticated: true,
        visibility: 'public',
        reason: 'authorization_unavailable',
      }),
    };
  }
}
