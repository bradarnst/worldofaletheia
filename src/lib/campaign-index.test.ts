import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignIndexModel,
  createCampaignIndexDiscoveryAccessScope,
  type CampaignIndexMetadataLoader,
} from '~/lib/campaign-index';
import { parseCampaignGateManifest } from '~/lib/campaign-gate-policy';

function createMetadataLoader(titlesBySlug: Record<string, string>): CampaignIndexMetadataLoader {
  return vi.fn(async ({ campaignSlug }) => {
    const title = titlesBySlug[campaignSlug];
    return title
      ? { ok: true as const, title }
      : { ok: false as const, reason: 'notFoundOrNotReadable' };
  });
}

describe('campaign index model', () => {
  it('renders public discovery titles for anonymous visitors without protected item metadata', async () => {
    const loadCampaignMetadata = createMetadataLoader({
      brad: 'The Weight of Sun and Soil',
      barry: 'Ashes Under Moonlight',
    });

    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }, { slug: 'barry' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({ brad: 'campaignMembers', barry: 'public' }),
      loadCampaignMetadata,
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'The Weight of Sun and Soil',
        gate: 'campaignMembers',
        isAvailable: true,
      }),
      expect.objectContaining({ slug: 'barry', title: 'Ashes Under Moonlight', gate: 'public', isAvailable: true }),
    ]);
    expect(JSON.stringify(model)).not.toContain('protectedRecordCount');
    expect(JSON.stringify(model)).not.toContain('publicRecordCount');
    expect(JSON.stringify(model)).not.toContain('Secret Session');
  });

  it('renders the same public discovery titles for signed-in visitors', async () => {
    const loadCampaignMetadata = createMetadataLoader({ brad: 'The Weight of Sun and Soil' });

    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }],
      viewer: { kind: 'authenticated', userId: 'user_123', traceId: 'request_123' },
      gateManifest: parseCampaignGateManifest({ brad: 'campaignMembers' }),
      loadCampaignMetadata,
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'The Weight of Sun and Soil',
        gate: 'campaignMembers',
        isAvailable: true,
      }),
    ]);
    expect(loadCampaignMetadata).toHaveBeenCalledWith({
      campaignSlug: 'brad',
      accessScope: createCampaignIndexDiscoveryAccessScope({ kind: 'authenticated', userId: 'user_123', traceId: 'request_123' }),
    });
  });

  it('does not hide source-available campaigns when the gate manifest entry is missing', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'source-only-campaign' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({}, { logger }),
      logger,
      loadCampaignMetadata: createMetadataLoader({ 'source-only-campaign': 'Source Only Campaign' }),
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({ slug: 'source-only-campaign', title: 'Source Only Campaign', gateSource: 'missing-default' }),
    ]);
    expect(logger.warn).toHaveBeenCalledWith('campaign.gate_manifest.missing_entry', {
      campaignSlug: 'source-only-campaign',
      fallbackGate: 'campaignMembers',
    });
  });

  it('keeps source failures generic for visitors and logs operator diagnostics', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };

    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({ brad: 'public' }, { logger }),
      logger,
      loadCampaignMetadata: vi.fn(async () => ({ ok: false as const, reason: 'sourceUnavailable' })),
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'Campaign temporarily unavailable',
        isAvailable: false,
        unavailableMessage: 'Campaign discovery is temporarily unavailable.',
      }),
    ]);
    expect(model.unavailableCampaignCount).toBe(1);
    expect(JSON.stringify(model)).not.toContain('woa-admin');
    expect(JSON.stringify(model)).not.toContain('runtime assertion');
    expect(logger.error).toHaveBeenCalledWith('campaign.index.metadata_unavailable', {
      campaignSlug: 'brad',
      reason: 'sourceUnavailable',
    });
  });
});
