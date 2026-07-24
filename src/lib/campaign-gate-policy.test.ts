import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_GATE_MANIFEST,
  decideCampaignGateAccess,
  deriveAllowedContentVisibilities,
  getCampaignGate,
  parseCampaignGateManifest,
} from '~/lib/campaign-gate-policy';

describe('campaign gate policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the non-dynamic manifest keyed by campaign slug', () => {
    expect(CAMPAIGN_GATE_MANIFEST).toMatchObject({
      brad: 'campaignMembers',
      barry: 'campaignMembers',
      'sample-campaign': 'public',
    });
  });

  it('parses only public and campaignMembers gate values', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };

    const manifest = parseCampaignGateManifest(
      {
        'public-campaign': 'public',
        'member-campaign': 'campaignMembers',
        'gm-campaign': 'gm',
        blank: '',
      },
      { logger },
    );

    expect(manifest.entries).toEqual({
      'public-campaign': 'public',
      'member-campaign': 'campaignMembers',
      'gm-campaign': 'campaignMembers',
      blank: 'campaignMembers',
    });
    expect(getCampaignGate('gm-campaign', manifest)).toMatchObject({
      gate: 'campaignMembers',
      source: 'invalid-default',
    });
    expect(logger.error).toHaveBeenCalledWith('campaign.gate_manifest.invalid_value', {
      campaignSlug: 'gm-campaign',
      value: 'gm',
      fallbackGate: 'campaignMembers',
    });
    expect(logger.error).toHaveBeenCalledWith('campaign.gate_manifest.invalid_value', {
      campaignSlug: 'blank',
      value: '',
      fallbackGate: 'campaignMembers',
    });
  });

  it('defaults missing entries to campaignMembers with an operator warning', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const manifest = parseCampaignGateManifest({ known: 'public' }, { logger });

    expect(getCampaignGate('source-only-campaign', manifest, { logger })).toEqual({
      campaignSlug: 'source-only-campaign',
      gate: 'campaignMembers',
      source: 'missing-default',
    });
    expect(logger.warn).toHaveBeenCalledWith('campaign.gate_manifest.missing_entry', {
      campaignSlug: 'source-only-campaign',
      fallbackGate: 'campaignMembers',
    });
  });

  it('derives cumulative allowed visibility for public gate requests', () => {
    expect(deriveAllowedContentVisibilities({ gate: 'public', campaignAccessRole: 'anonymous' })).toEqual(['public']);
    expect(deriveAllowedContentVisibilities({ gate: 'public', campaignAccessRole: 'member' })).toEqual([
      'public',
      'campaignMembers',
    ]);
    expect(deriveAllowedContentVisibilities({ gate: 'public', campaignAccessRole: 'gm' })).toEqual([
      'public',
      'campaignMembers',
      'gm',
    ]);
  });

  it('derives cumulative allowed visibility for campaign member gate requests', () => {
    expect(deriveAllowedContentVisibilities({ gate: 'campaignMembers', campaignAccessRole: 'anonymous' })).toEqual([]);
    expect(deriveAllowedContentVisibilities({ gate: 'campaignMembers', campaignAccessRole: 'member' })).toEqual([
      'public',
      'campaignMembers',
    ]);
    expect(deriveAllowedContentVisibilities({ gate: 'campaignMembers', campaignAccessRole: 'gm' })).toEqual([
      'public',
      'campaignMembers',
      'gm',
    ]);
  });

  it('blocks source fetches when the campaign gate fails', () => {
    const manifest = parseCampaignGateManifest({ brad: 'campaignMembers' });

    expect(
      decideCampaignGateAccess({
        campaignSlug: 'brad',
        manifest,
        campaignAccessRole: 'anonymous',
      }),
    ).toMatchObject({
      campaignSlug: 'brad',
      gate: 'campaignMembers',
      allowedVisibilities: [],
      gateAllowsRequest: false,
      mayFetchSource: false,
      reason: 'campaign_membership_required',
    });
  });

  it('does not make source-available campaigns unavailable when a manifest entry is missing', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const manifest = parseCampaignGateManifest({}, { logger });

    expect(
      decideCampaignGateAccess({
        campaignSlug: 'source-only-campaign',
        manifest,
        campaignAccessRole: 'member',
        logger,
      }),
    ).toMatchObject({
      gate: 'campaignMembers',
      gateSource: 'missing-default',
      allowedVisibilities: ['public', 'campaignMembers'],
      gateAllowsRequest: true,
      mayFetchSource: true,
      reason: 'campaign_member_allowed',
    });
  });
});
