// src/lib/campaign-page-request-context.ts
//
// Wires an Astro request into the viewer + per-campaign access-role resolver that
// `buildCampaignContentPageModel` needs. Shared by the campaign root and about pages so
// the session-to-viewer mapping and the request access resolver are defined once.

import { getRequestSession } from '~/lib/auth-session';
import { createCampaignRequestAccessResolver } from '~/lib/campaign-request-access';
import type { CampaignAccessRole } from '~/lib/campaign-gate-policy';
import type { CampaignContentPageViewer } from '~/lib/campaign-content-page';

export interface CampaignPageRequestContext {
  viewer: CampaignContentPageViewer;
  getCampaignAccessRole: (campaignSlug: string) => Promise<CampaignAccessRole>;
}

export async function createCampaignPageRequestContext(options: {
  request: Request;
  locals: unknown;
  hostname: string;
}): Promise<CampaignPageRequestContext> {
  const session = await getRequestSession(options.request, options.locals);
  const viewer: CampaignContentPageViewer = session
    ? { kind: 'authenticated', userId: session.user.id, traceId: session.session.id }
    : { kind: 'anonymous' };

  const accessResolver = await createCampaignRequestAccessResolver({
    request: options.request,
    locals: options.locals,
    hostname: options.hostname,
  });

  const getCampaignAccessRole = async (campaignSlug: string): Promise<CampaignAccessRole> => {
    const { isMember, isGm } = await accessResolver.hasCampaignAccess(campaignSlug);
    return isGm ? 'gm' : isMember ? 'member' : 'anonymous';
  };

  return { viewer, getCampaignAccessRole };
}
