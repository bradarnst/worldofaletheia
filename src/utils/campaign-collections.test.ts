import { describe, expect, it } from 'vitest';
import { extractCampaignSlugFromEntryId } from './campaign-collections';

describe('extractCampaignSlugFromEntryId', () => {
  it('uses the first segment for current cloud campaign ids', () => {
    expect(extractCampaignSlugFromEntryId('barry/index')).toBe('barry');
    expect(extractCampaignSlugFromEntryId('barry/lore/omens')).toBe('barry');
  });

  it('continues to support legacy prefixed campaign ids', () => {
    expect(extractCampaignSlugFromEntryId('campaigns/barry/Campaign - Barry')).toBe('barry');
  });
});
