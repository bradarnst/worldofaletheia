// src/pages/campaigns/[campaign]/assets/[...path].ts
//
// Main-site Campaign Content asset route (issue #11). Proxies `woa-admin` source
// asset bytes so rendered Campaign Content HTML never references `woa-admin`
// directly. Access derives from the Campaign Gate + membership-derived visibility
// scope; the handler signs a campaign-scoped runtime assertion before fetching.

import type { APIRoute } from 'astro';
import { handleCampaignContentAssetRequest } from '~/lib/campaign-content-asset-handler';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params, url }) => {
  return handleCampaignContentAssetRequest({
    request,
    locals,
    params: { campaign: params.campaign, path: params.path },
    url,
  });
};
