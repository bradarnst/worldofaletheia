import type { APIRoute } from 'astro';
import { handleCampaignMediaRequest } from '~/lib/campaign-media-handler';

export const GET: APIRoute = async ({ request, locals, params }) => {
  const response = await handleCampaignMediaRequest({
    request,
    locals,
    params,
  });

  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
};
