import { getCollection } from 'astro:content';
import { canViewCampaignContentAsync, type CampaignVisibility } from '@utils/campaign-access';
import { createCampaignRequestAccessResolver } from './campaign-request-access';
import {
  buildCampaignImageObjectKey,
  createCampaignMediaResponse,
  getCampaignMediaBucketFromLocals,
  normalizeCampaignMediaAssetPath,
  normalizeCampaignMediaVariant,
} from './campaign-media';

interface CampaignEntryLike {
  id: string;
  data: {
    visibility?: CampaignVisibility;
  };
}

function findCampaignEntry(entries: CampaignEntryLike[], campaignSlug: string): CampaignEntryLike | null {
  return entries.find((entry) => entry.id.split('/')[0] === campaignSlug) ?? null;
}

function createFailClosedResponse(visibility: CampaignVisibility | null): Response {
  if (visibility === 'public') {
    return new Response('Campaign media is temporarily unavailable.', { status: 503 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function handleCampaignMediaRequest(context: {
  request: Request;
  locals: unknown;
  params: Record<string, string | undefined>;
}): Promise<Response> {
  const campaignSlug = context.params.campaign?.trim();
  const variant = normalizeCampaignMediaVariant(context.params.variant);
  const assetPath = normalizeCampaignMediaAssetPath(context.params.asset);

  if (!campaignSlug || !variant || !assetPath) {
    return new Response('Not Found', { status: 404 });
  }

  let campaignEntry: CampaignEntryLike | null = null;
  try {
    campaignEntry = findCampaignEntry((await getCollection('campaigns')) as CampaignEntryLike[], campaignSlug);
  } catch (error) {
    console.error('campaign.media.metadata_unavailable', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return createFailClosedResponse(null);
  }

  if (!campaignEntry) {
    return new Response('Not Found', { status: 404 });
  }

  const visibility = campaignEntry.data.visibility ?? 'gm';

  try {
    const accessResolver = await createCampaignRequestAccessResolver({
      request: context.request,
      locals: context.locals,
      hostname: new URL(context.request.url).hostname,
    });
    const canView = await canViewCampaignContentAsync({
      visibility,
      campaignSlug,
      access: accessResolver,
    });

    if (!canView) {
      return new Response('Forbidden', { status: 403 });
    }
  } catch (error) {
    console.error('campaign.media.auth_unavailable', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return createFailClosedResponse(visibility);
  }

  let bucket;
  try {
    bucket = getCampaignMediaBucketFromLocals(context.locals);
  } catch (error) {
    console.error('campaign.media.binding_unavailable', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return createFailClosedResponse(visibility);
  }

  try {
    const object = await bucket.get(
      buildCampaignImageObjectKey({
        campaignSlug,
        variant,
        assetPath,
      }),
    );

    if (!object || !object.body) {
      return new Response('Not Found', { status: 404 });
    }

    return createCampaignMediaResponse(object, assetPath);
  } catch (error) {
    console.error('campaign.media.read_failed', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return createFailClosedResponse(visibility);
  }
}
