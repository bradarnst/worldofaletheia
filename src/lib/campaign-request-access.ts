import { createCampaignAccessResolverFromRequest } from '@utils/campaign-access';
import { getCloudflareRuntimeEnv } from '@utils/cloudflare-env';
import { getCampaignGmAssignmentsForEnv, getCampaignMembershipConfigForEnv } from '@utils/campaign-membership-config';

export async function createCampaignRequestAccessResolver(options: {
  request: Request;
  locals: unknown;
  hostname: string;
}) {
  const runtimeEnv = await getCloudflareRuntimeEnv();
  const membershipConfigRaw =
    typeof runtimeEnv?.CAMPAIGN_MEMBERSHIPS === 'string' && runtimeEnv.CAMPAIGN_MEMBERSHIPS.length > 0
      ? runtimeEnv.CAMPAIGN_MEMBERSHIPS
      : getCampaignMembershipConfigForEnv();
  const gmAssignmentsConfigRaw =
    typeof runtimeEnv?.CAMPAIGN_GM_ASSIGNMENTS === 'string' && runtimeEnv.CAMPAIGN_GM_ASSIGNMENTS.length > 0
      ? runtimeEnv.CAMPAIGN_GM_ASSIGNMENTS
      : getCampaignGmAssignmentsForEnv();
  const allowLegacyEnvFallback = options.hostname === 'localhost' || options.hostname === '127.0.0.1';

  return createCampaignAccessResolverFromRequest({
    request: options.request,
    locals: options.locals,
    membershipConfigRaw,
    gmAssignmentsConfigRaw,
    allowLegacyEnvFallback,
  });
}
