import { describe, expect, it } from 'vitest';
import {
  renameCampaignSlugInAccessConfig,
  rewriteCampaignFrontmatter,
} from './rename-campaign-slug.mjs';

describe('rename-campaign-slug helpers', () => {
  it('rewrites campaign frontmatter values while preserving quote style', () => {
    const markdown = `---
title: Example
campaign: "brad"
visibility: campaignMembers
---

Body
`;

    expect(rewriteCampaignFrontmatter(markdown, 'brad', 'river-of-glass')).toContain('campaign: "river-of-glass"');
  });

  it('renames campaign references in membership config', () => {
    const updated = renameCampaignSlugInAccessConfig(
      {
        memberships: {
          brad: { campaigns: { brad: 'gm', barry: 'member' } },
          fred: { campaigns: ['brad'] },
        },
        gmAssignments: {
          brad: { userId: 'brad' },
          barry: { userId: 'barry' },
        },
      },
      'brad',
      'river-of-glass',
    );

    expect(updated.memberships.brad.campaigns).toEqual({ 'river-of-glass': 'gm', barry: 'member' });
    expect(updated.memberships.fred.campaigns).toEqual(['river-of-glass']);
    expect(updated.gmAssignments).toEqual({
      'river-of-glass': { userId: 'brad' },
      barry: { userId: 'barry' },
    });
  });

  it('does not introduce legacy gmAssignments when config already uses the unified shape', () => {
    const updated = renameCampaignSlugInAccessConfig(
      {
        memberships: {
          brad: { campaigns: { brad: 'gm', barry: 'member' } },
        },
      },
      'brad',
      'river-of-glass',
    );

    expect(updated).toEqual({
      memberships: {
        brad: { campaigns: { 'river-of-glass': 'gm', barry: 'member' } },
      },
    });
  });
});
