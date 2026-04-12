import { describe, expect, it } from 'vitest';
import { normalizeCampaignMembershipConfig } from './campaign-membership-config';

describe('campaign membership config normalization', () => {
  it('returns empty config for invalid root shape', () => {
    expect(normalizeCampaignMembershipConfig(null)).toEqual({ memberships: {} });
    expect(normalizeCampaignMembershipConfig([])).toEqual({ memberships: {} });
    expect(normalizeCampaignMembershipConfig({ memberships: [] })).toEqual({ memberships: {} });
  });

  it('normalizes legacy arrays and role maps into one membership-role source', () => {
    const result = normalizeCampaignMembershipConfig({
      memberships: {
        jim: { campaigns: { brad: 'member', barry: 'gm', broken: 'owner' } },
        fred: { campaigns: ['brad', 'barry'] },
        broken1: { campaigns: [123, 'brad'] },
        broken2: { campaigns: 'barry' },
      },
    });

    expect(result).toEqual({
      memberships: {
        jim: { campaigns: { brad: 'member', barry: 'gm' } },
        fred: { campaigns: { brad: 'member', barry: 'member' } },
        broken1: { campaigns: { brad: 'member' } },
      },
    });
  });
});
