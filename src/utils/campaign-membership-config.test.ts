import { describe, expect, it } from 'vitest';
import { normalizeCampaignMembershipConfig } from './campaign-membership-config';

describe('campaign membership config normalization', () => {
  it('returns empty config for invalid root shape', () => {
    expect(normalizeCampaignMembershipConfig(null)).toEqual({ memberships: {}, gmAssignments: {} });
    expect(normalizeCampaignMembershipConfig([])).toEqual({ memberships: {}, gmAssignments: {} });
    expect(normalizeCampaignMembershipConfig({ memberships: [] })).toEqual({ memberships: {}, gmAssignments: {} });
  });

  it('keeps only valid user membership mappings', () => {
    const result = normalizeCampaignMembershipConfig({
      memberships: {
        jim: { campaigns: ['brad'] },
        fred: { campaigns: ['brad', 'barry'] },
        broken1: { campaigns: [123, 'brad'] },
        broken2: { campaigns: 'barry' },
      },
      gmAssignments: {
        brad: { userId: 'jim' },
        barry: { userId: 'tom' },
        broken1: { userId: '' },
        broken2: { noUserId: 'x' },
      },
    });

    expect(result).toEqual({
      memberships: {
        jim: { campaigns: ['brad'] },
        fred: { campaigns: ['brad', 'barry'] },
        broken1: { campaigns: ['brad'] },
      },
      gmAssignments: {
        brad: { userId: 'jim' },
        barry: { userId: 'tom' },
      },
    });
  });
});
