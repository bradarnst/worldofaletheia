import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignIndexModel,
  loadCampaignSurfaceGateManifestFailClosed,
  loadCampaignSurfaceGateManifest,
  type CampaignSurfaceRegistryLoader,
} from '~/lib/campaign-index';

function createRegistryLoader(items: Awaited<ReturnType<CampaignSurfaceRegistryLoader>>): CampaignSurfaceRegistryLoader {
  return vi.fn(async () => items);
}

describe('campaign index model', () => {
  it('renders public discovery surfaces from the Campaign Surface Registry', async () => {
    const loadCampaignSurfaces = createRegistryLoader([
      { campaignSlug: 'brad', title: 'The Weight of Sun and Soil', gate: 'campaignMembers', updatedAt: '2026-07-29T00:00:00Z' },
      { campaignSlug: 'barry', title: 'Ashes Under Moonlight', gate: 'public', updatedAt: '2026-07-29T00:00:00Z' },
    ]);

    const model = await buildCampaignIndexModel({
      viewer: { kind: 'anonymous' },
      loadCampaignSurfaces,
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'The Weight of Sun and Soil',
        gate: 'campaignMembers',
        gateSource: 'registry',
        isAvailable: true,
      }),
      expect.objectContaining({ slug: 'barry', title: 'Ashes Under Moonlight', gate: 'public', gateSource: 'registry', isAvailable: true }),
    ]);
    expect(JSON.stringify(model)).not.toContain('protectedRecordCount');
    expect(JSON.stringify(model)).not.toContain('publicRecordCount');
    expect(JSON.stringify(model)).not.toContain('Secret Session');
  });

  it('renders the same registry titles for signed-in visitors without member-only metadata', async () => {
    const loadCampaignSurfaces = createRegistryLoader([
      { campaignSlug: 'brad', title: 'The Weight of Sun and Soil', gate: 'campaignMembers', updatedAt: '2026-07-29T00:00:00Z' },
    ]);

    const model = await buildCampaignIndexModel({
      viewer: { kind: 'authenticated', userId: 'user_123', traceId: 'request_123' },
      loadCampaignSurfaces,
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'The Weight of Sun and Soil',
        gate: 'campaignMembers',
        isAvailable: true,
      }),
    ]);
    expect(loadCampaignSurfaces).toHaveBeenCalledOnce();
  });

  it('degrades to an empty listing when the registry source is unavailable', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };

    const model = await buildCampaignIndexModel({
      viewer: { kind: 'anonymous' },
      logger,
      loadCampaignSurfaces: vi.fn(async () => {
        throw new Error('sourceUnavailable');
      }),
    });

    expect(model).toEqual({ campaigns: [], unavailableCampaignCount: 0 });
    expect(logger.error).toHaveBeenCalledWith('campaign.index.registry_unavailable', { reason: 'sourceUnavailable' });
  });

  it('keeps rendering valid registry items when one item has malformed title data', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const malformedSurface = JSON.parse('{"campaignSlug":"brad","title":123,"gate":"public","updatedAt":"2026-07-29T00:00:00Z"}');

    const model = await buildCampaignIndexModel({
      viewer: { kind: 'anonymous' },
      logger,
      campaigns: [malformedSurface, { campaignSlug: 'barry', title: 'Ashes Under Moonlight', gate: 'public' }],
      loadCampaignSurfaces: createRegistryLoader([]),
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({ slug: 'brad', title: 'Campaign temporarily unavailable', isAvailable: false }),
      expect.objectContaining({ slug: 'barry', title: 'Ashes Under Moonlight', gate: 'public', isAvailable: true }),
    ]);
    expect(logger.error).toHaveBeenCalledWith('campaign.index.metadata_unavailable', {
      campaignSlug: 'brad',
      reason: 'malformedTitle',
    });
  });
});

describe('campaign registry gate manifest', () => {
  it('converts registry gates into registry-sourced Campaign Gate metadata', async () => {
    const manifest = await loadCampaignSurfaceGateManifest({
      loadCampaignSurfaces: createRegistryLoader([
        { campaignSlug: 'public-campaign', title: 'Public Campaign', gate: 'public', updatedAt: '2026-07-29T00:00:00Z' },
        { campaignSlug: 'members-campaign', title: 'Members Campaign', gate: 'campaignMembers', updatedAt: '2026-07-29T00:00:00Z' },
      ]),
    });

    expect(manifest).toEqual({
      entries: {
        'public-campaign': 'public',
        'members-campaign': 'campaignMembers',
      },
      sources: {
        'public-campaign': 'registry',
        'members-campaign': 'registry',
      },
    });
  });

  it('returns an empty registry-sourced manifest when registry loading fails', async () => {
    const manifest = await loadCampaignSurfaceGateManifestFailClosed({
      loadCampaignSurfaces: vi.fn(async () => {
        throw new Error('sourceUnavailable');
      }),
    });

    expect(manifest).toEqual({ entries: {}, sources: {} });
  });
});
