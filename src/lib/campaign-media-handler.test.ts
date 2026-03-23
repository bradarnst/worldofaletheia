import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));

vi.mock('./campaign-request-access', () => ({
  createCampaignRequestAccessResolver: vi.fn(),
}));

vi.mock('@utils/campaign-access', () => ({
  canViewCampaignContentAsync: vi.fn(),
}));

vi.mock('./campaign-media', () => ({
  normalizeCampaignMediaVariant: vi.fn((value: string | undefined) => value ?? null),
  normalizeCampaignMediaAssetPath: vi.fn((value: string | undefined) => value ?? null),
  buildCampaignImageObjectKey: vi.fn(({ campaignSlug, variant, assetPath }) =>
    `campaigns/${campaignSlug}/assets/images/variants/${variant}/${assetPath}`,
  ),
  getCampaignMediaBucketFromLocals: vi.fn(),
  createCampaignMediaResponse: vi.fn(() => new Response('image-bytes', { status: 200 })),
}));

import { getCollection } from 'astro:content';
import { canViewCampaignContentAsync } from '@utils/campaign-access';
import { createCampaignRequestAccessResolver } from './campaign-request-access';
import {
  buildCampaignImageObjectKey,
  createCampaignMediaResponse,
  getCampaignMediaBucketFromLocals,
} from './campaign-media';
import { handleCampaignMediaRequest } from './campaign-media-handler';

const getCollectionMock = vi.mocked(getCollection);
const canViewCampaignContentAsyncMock = vi.mocked(canViewCampaignContentAsync);
const createCampaignRequestAccessResolverMock = vi.mocked(createCampaignRequestAccessResolver);
const buildCampaignImageObjectKeyMock = vi.mocked(buildCampaignImageObjectKey);
const createCampaignMediaResponseMock = vi.mocked(createCampaignMediaResponse);
const getCampaignMediaBucketFromLocalsMock = vi.mocked(getCampaignMediaBucketFromLocals);

describe('handleCampaignMediaRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createCampaignRequestAccessResolverMock.mockResolvedValue({
      hasCampaignAccess: async () => ({ isMember: false, isGm: false }),
    });
  });

  it('fails closed when campaign metadata cannot be loaded', async () => {
    getCollectionMock.mockRejectedValue(new Error('r2 manifest unavailable'));

    const response = await handleCampaignMediaRequest({
      request: new Request('https://example.com/api/campaign-media/brad/images/detail/map.png'),
      locals: {},
      params: { campaign: 'brad', variant: 'detail', asset: 'map.png' },
    });

    expect(response.status).toBe(403);
  });

  it('returns forbidden when the user cannot view protected campaign media', async () => {
    getCollectionMock.mockResolvedValue([
      { id: 'brad/index', data: { visibility: 'campaignMembers' } },
    ] as never);
    canViewCampaignContentAsyncMock.mockResolvedValue(false);

    const response = await handleCampaignMediaRequest({
      request: new Request('https://example.com/api/campaign-media/brad/images/detail/map.png'),
      locals: {},
      params: { campaign: 'brad', variant: 'detail', asset: 'map.png' },
    });

    expect(response.status).toBe(403);
    expect(getCampaignMediaBucketFromLocalsMock).not.toHaveBeenCalled();
  });

  it('returns service unavailable for public media when storage reads fail', async () => {
    getCollectionMock.mockResolvedValue([
      { id: 'barry/index', data: { visibility: 'public' } },
    ] as never);
    canViewCampaignContentAsyncMock.mockResolvedValue(true);
    getCampaignMediaBucketFromLocalsMock.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('r2 down')),
    } as never);

    const response = await handleCampaignMediaRequest({
      request: new Request('https://example.com/api/campaign-media/barry/images/detail/map.png'),
      locals: {},
      params: { campaign: 'barry', variant: 'detail', asset: 'map.png' },
    });

    expect(response.status).toBe(503);
  });

  it('serves media for authorized requests', async () => {
    getCollectionMock.mockResolvedValue([
      { id: 'barry/index', data: { visibility: 'public' } },
    ] as never);
    canViewCampaignContentAsyncMock.mockResolvedValue(true);
    getCampaignMediaBucketFromLocalsMock.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream<Uint8Array>(),
      }),
    } as never);

    const response = await handleCampaignMediaRequest({
      request: new Request('https://example.com/api/campaign-media/barry/images/detail/map.png'),
      locals: {},
      params: { campaign: 'barry', variant: 'detail', asset: 'map.png' },
    });

    expect(response.status).toBe(200);
    expect(buildCampaignImageObjectKeyMock).toHaveBeenCalledWith({
      campaignSlug: 'barry',
      variant: 'detail',
      assetPath: 'map.png',
    });
    expect(createCampaignMediaResponseMock).toHaveBeenCalled();
  });
});
