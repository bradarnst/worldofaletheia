import type { APIRoute } from 'astro';
import {
  errorResponse,
  getAuthenticatedCampaignAdminContext,
  isResponse,
  jsonResponse,
  type CampaignAdminCapabilityDto,
} from '@utils/campaign-admin-api';

export const GET: APIRoute = async (context) => {
  const adminContext = await getAuthenticatedCampaignAdminContext(context);
  if (isResponse(adminContext)) {
    return adminContext;
  }

  try {
    const canAdministerUsers = await adminContext.repo.isUserGmOfCampaign(
      adminContext.session.user.id,
      adminContext.campaignSlug,
    );
    const body: CampaignAdminCapabilityDto = {
      campaignSlug: adminContext.campaignSlug,
      actor: {
        userId: adminContext.session.user.id,
        displayName: adminContext.session.user.name || null,
      },
      canAdministerUsers,
      capabilities: canAdministerUsers ? ['user-admin'] : [],
      source: canAdministerUsers ? 'campaign-gm' : 'none',
    };

    return jsonResponse(body);
  } catch (error) {
    console.error('campaign.admin_capability.lookup_failed', {
      campaignSlug: adminContext.campaignSlug,
      actorUserId: adminContext.session.user.id,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.');
  }
};
