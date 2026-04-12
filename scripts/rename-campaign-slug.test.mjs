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
      },
      'brad',
      'river-of-glass',
    );

    expect(updated.memberships.brad.campaigns).toEqual({ 'river-of-glass': 'gm', barry: 'member' });
    expect(updated.memberships.fred.campaigns).toEqual(['river-of-glass']);
  });
});
