import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignIndexModel,
  createCampaignIndexLiveMetadataLoader,
  createCampaignIndexDiscoveryAccessScope,
  type CampaignIndexLiveEntryGetter,
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
      expect.objectContaining({
        slug: 'source-only-campaign',
        title: 'Source Only Campaign',
        gate: 'campaignMembers',
        gateSource: 'missing-default',
      }),
    ]);
    expect(logger.warn).toHaveBeenCalledWith('campaign.gate_manifest.missing_entry', {
      campaignSlug: 'source-only-campaign',
      fallbackGate: 'campaignMembers',
    });
  });

  it('builds page-safe render data for anonymous and signed-in visitors without operator diagnostic leakage', async () => {
    // Full .astro page rendering is not wired into this Vitest setup; this seam covers the model fields rendered by
    // src/pages/campaigns/index.astro for both viewer states.
    const viewers = [
      { kind: 'anonymous' as const },
      { kind: 'authenticated' as const, userId: 'user_123', traceId: 'request_123' },
    ];

    for (const viewer of viewers) {
      const model = await buildCampaignIndexModel({
        campaigns: [{ slug: 'brad' }],
        viewer,
        gateManifest: parseCampaignGateManifest({ brad: 'public' }),
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
      expect(JSON.stringify(model)).not.toContain('woa-admin');
      expect(JSON.stringify(model)).not.toContain('runtime assertion');
    }
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

  it('keeps rendering other campaigns when one metadata load rejects', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }, { slug: 'barry' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({ brad: 'public', barry: 'public' }, { logger }),
      logger,
      loadCampaignMetadata: vi.fn(async ({ campaignSlug }) => {
        if (campaignSlug === 'brad') {
          throw new Error('source timed out');
        }

        return { ok: true as const, title: 'Ashes Under Moonlight' };
      }),
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({ slug: 'brad', title: 'Campaign temporarily unavailable', isAvailable: false }),
      expect.objectContaining({ slug: 'barry', title: 'Ashes Under Moonlight', isAvailable: true }),
    ]);
    expect(logger.error).toHaveBeenCalledWith('campaign.index.metadata_unavailable', {
      campaignSlug: 'brad',
      reason: 'loaderRejected',
      message: 'source timed out',
    });
  });

  it('keeps rendering other campaigns when metadata returns malformed title data', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const malformedTitleResult = JSON.parse('{"ok":true,"title":123}');
    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }, { slug: 'barry' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({ brad: 'public', barry: 'public' }, { logger }),
      logger,
      loadCampaignMetadata: vi.fn(async ({ campaignSlug }) => {
        if (campaignSlug === 'brad') {
          return malformedTitleResult;
        }

        return { ok: true as const, title: 'Ashes Under Moonlight' };
      }),
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({ slug: 'brad', title: 'Campaign temporarily unavailable', isAvailable: false }),
      expect.objectContaining({ slug: 'barry', title: 'Ashes Under Moonlight', isAvailable: true }),
    ]);
    expect(logger.error).toHaveBeenCalledWith('campaign.index.metadata_unavailable', {
      campaignSlug: 'brad',
      reason: 'malformedTitle',
    });
  });
});

describe('campaign index live metadata loader', () => {
  it('loads the campaign root document deterministically', async () => {
    const getLiveEntry = vi.fn(async () => ({
      entry: { data: { title: 'The Weight of Sun and Soil' } },
    })) satisfies CampaignIndexLiveEntryGetter;
    const accessScope = createCampaignIndexDiscoveryAccessScope({ kind: 'anonymous' });
    const loadCampaignMetadata = createCampaignIndexLiveMetadataLoader({ getLiveEntry });

    await expect(loadCampaignMetadata({ campaignSlug: 'brad', accessScope })).resolves.toEqual({
      ok: true,
      title: 'The Weight of Sun and Soil',
    });
    expect(getLiveEntry).toHaveBeenCalledWith('campaignContent', {
      campaignSlug: 'brad',
      collectionKey: 'pages',
      documentId: 'index',
      accessScope,
    });
  });

  it('preserves missing campaign root behavior for not-found live entries', async () => {
    const logger = { error: vi.fn() };
    const getLiveEntry = vi.fn(async () => ({
      error: { name: 'LiveEntryNotFoundError', message: 'Entry campaignContent → brad/pages/index was not found.' },
    })) satisfies CampaignIndexLiveEntryGetter;
    const loadCampaignMetadata = createCampaignIndexLiveMetadataLoader({ getLiveEntry, logger });

    await expect(
      loadCampaignMetadata({
        campaignSlug: 'brad',
        accessScope: createCampaignIndexDiscoveryAccessScope({ kind: 'anonymous' }),
      }),
    ).resolves.toEqual({ ok: false, reason: 'missingCampaignRoot' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('preserves missing campaign root behavior when Astro returns no entry', async () => {
    const getLiveEntry = vi.fn(async () => ({})) satisfies CampaignIndexLiveEntryGetter;
    const loadCampaignMetadata = createCampaignIndexLiveMetadataLoader({ getLiveEntry });

    await expect(
      loadCampaignMetadata({
        campaignSlug: 'brad',
        accessScope: createCampaignIndexDiscoveryAccessScope({ kind: 'anonymous' }),
      }),
    ).resolves.toEqual({ ok: false, reason: 'missingCampaignRoot' });
  });

  it('extracts live error diagnostics while keeping returned render data generic', async () => {
    const logger = { error: vi.fn() };
    const getLiveEntry = vi.fn(async () => ({
      error: {
        name: 'CampaignContentLiveLoaderError',
        message: 'woa-admin runtime assertion failed',
        sourceFailure: {
          ok: false,
          reason: 'sourceUnavailable',
          mainSiteStatus: 503,
          retryable: true,
          safeMessage: 'Campaign content unavailable.',
        },
      },
    })) satisfies CampaignIndexLiveEntryGetter;
    const accessScope = createCampaignIndexDiscoveryAccessScope({ kind: 'anonymous' });
    const loadCampaignMetadata = createCampaignIndexLiveMetadataLoader({ getLiveEntry, logger });
    const model = await buildCampaignIndexModel({
      campaigns: [{ slug: 'brad' }],
      viewer: { kind: 'anonymous' },
      gateManifest: parseCampaignGateManifest({ brad: 'public' }),
      logger: { warn: vi.fn(), error: vi.fn() },
      loadCampaignMetadata,
    });

    expect(model.campaigns).toEqual([
      expect.objectContaining({
        slug: 'brad',
        title: 'Campaign temporarily unavailable',
        isAvailable: false,
        unavailableMessage: 'Campaign discovery is temporarily unavailable.',
      }),
    ]);
    expect(JSON.stringify(model)).not.toContain('woa-admin');
    expect(JSON.stringify(model)).not.toContain('runtime assertion');
    expect(logger.error).toHaveBeenCalledWith('campaign.index.live_entry_error', {
      campaignSlug: 'brad',
      reason: 'sourceUnavailable',
      name: 'CampaignContentLiveLoaderError',
      message: 'woa-admin runtime assertion failed',
      sourceFailureReason: 'sourceUnavailable',
    });
  });
});
