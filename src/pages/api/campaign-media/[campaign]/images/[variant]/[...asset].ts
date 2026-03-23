import type { APIRoute } from 'astro';
import { handleCampaignMediaRequest } from '~/lib/campaign-media-handler';

export const GET: APIRoute = async ({ request, locals, params }) =>
  handleCampaignMediaRequest({
    request,
    locals,
    params,
  });
