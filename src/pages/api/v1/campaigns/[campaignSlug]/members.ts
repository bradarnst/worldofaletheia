import type { APIRoute } from 'astro';
import {
  errorResponse,
  getAuthenticatedCampaignAdminContext,
  isResponse,
  jsonResponse,
  parseCampaignMemberEmailAddRequest,
  parseCampaignMemberListQuery,
  type CampaignMemberCreateResponseDto,
  type CampaignMemberPageDto,
} from '@utils/campaign-admin-api';

export const GET: APIRoute = async (context) => {
  const adminContext = await getAuthenticatedCampaignAdminContext(context);
  if (isResponse(adminContext)) {
    return adminContext;
  }

  const query = parseCampaignMemberListQuery(new URL(context.request.url));
  if (!query.ok) {
    return errorResponse(400, 'invalid_request', query.message);
  }

  try {
    const canAdministerUsers = await adminContext.repo.isUserGmOfCampaign(
      adminContext.session.user.id,
      adminContext.campaignSlug,
    );
    if (!canAdministerUsers) {
      return errorResponse(403, 'campaign_forbidden', 'You cannot administer users for this campaign.');
    }

    const page = await adminContext.repo.listCampaignMembers({
      campaignSlug: adminContext.campaignSlug,
      role: query.role,
      limit: query.limit,
      cursor: query.cursor,
    });
    const body: CampaignMemberPageDto = {
      campaignSlug: adminContext.campaignSlug,
      items: page.items,
      nextCursor: page.nextCursor,
    };

    return jsonResponse(body);
  } catch (error) {
    console.error('campaign.members.list_failed', {
      campaignSlug: adminContext.campaignSlug,
      actorUserId: adminContext.session.user.id,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.');
  }
};

export const POST: APIRoute = async (context) => {
  const adminContext = await getAuthenticatedCampaignAdminContext(context);
  if (isResponse(adminContext)) {
    return adminContext;
  }

  const requestBody = await parseCampaignMemberEmailAddRequest(context.request);
  if (!requestBody.ok) {
    return errorResponse(400, 'invalid_request', requestBody.message);
  }

  try {
    const canAdministerUsers = await adminContext.repo.isUserGmOfCampaign(
      adminContext.session.user.id,
      adminContext.campaignSlug,
    );
    if (!canAdministerUsers) {
      return errorResponse(403, 'campaign_forbidden', 'You cannot administer users for this campaign.');
    }

    const userLookup = await adminContext.repo.findUserByExactEmail(requestBody.body.email);
    if (userLookup.status === 'not_found') {
      return errorResponse(404, 'not_found', 'User not found for exact email.');
    }

    if (userLookup.status === 'duplicate') {
      console.error('campaign.members.email_lookup_duplicate', {
        campaignSlug: adminContext.campaignSlug,
        actorUserId: adminContext.session.user.id,
      });
      return errorResponse(409, 'conflict', 'The requested mutation could not be applied to the current state.');
    }

    const outcome = await adminContext.repo.createCampaignMember(
      adminContext.campaignSlug,
      userLookup.user.userId,
      requestBody.body.role,
    );

    if (outcome === 'already_exists') {
      return errorResponse(
        409,
        'conflict',
        'The user is already a campaign member. Use PUT /api/v1/campaigns/{campaignSlug}/members/{userId} to change role.',
      );
    }

    const member = await adminContext.repo.getCampaignMember(adminContext.campaignSlug, userLookup.user.userId);

    if (!member) {
      console.error('campaign.members.add_postcondition_failed', {
        campaignSlug: adminContext.campaignSlug,
        actorUserId: adminContext.session.user.id,
        targetUserId: userLookup.user.userId,
        outcome,
      });
      return errorResponse(409, 'conflict', 'The requested mutation could not be applied to the current state.');
    }

    console.info('campaign.members.add_by_email_succeeded', {
      campaignSlug: adminContext.campaignSlug,
      actorUserId: adminContext.session.user.id,
      targetUserId: member.userId,
      role: member.role,
      outcome,
    });

    const body: CampaignMemberCreateResponseDto = {
      member,
      outcome: 'created',
      confirmationMessage: 'Campaign membership created.',
    };

    return jsonResponse(body, 201);
  } catch (error) {
    console.error('campaign.members.add_by_email_failed', {
      campaignSlug: adminContext.campaignSlug,
      actorUserId: adminContext.session.user.id,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.');
  }
};
