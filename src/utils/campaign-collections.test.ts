import { describe, expect, it } from 'vitest';
import {
  extractCampaignFamilySlugFromEntryId,
  extractCampaignSlugFromEntryId,
  extractLeafSlugFromEntryId,
} from './campaign-collections';

describe('extractCampaignSlugFromEntryId', () => {
  it('uses the first segment for current cloud campaign ids', () => {
    expect(extractCampaignSlugFromEntryId('barry/index')).toBe('barry');
    expect(extractCampaignSlugFromEntryId('barry/lore/omens')).toBe('barry');
    expect(extractCampaignSlugFromEntryId('barry/sessions/session-zero')).toBe('barry');
  });

  it('continues to support legacy prefixed campaign ids', () => {
    expect(extractCampaignSlugFromEntryId('campaigns/barry/Campaign - Barry')).toBe('barry');
    expect(extractCampaignSlugFromEntryId('campaigns/barry/sessions/session-zero')).toBe('barry');
  });
});

describe('extractLeafSlugFromEntryId', () => {
  it('returns the leaf slug for session ids', () => {
    expect(extractLeafSlugFromEntryId('barry/sessions/session-zero')).toBe('session-zero');
    expect(extractLeafSlugFromEntryId('campaigns/barry/sessions/session-zero')).toBe('session-zero');
  });

  it('returns the leaf slug for family entry ids', () => {
    expect(extractLeafSlugFromEntryId('barry/lore/omens')).toBe('omens');
    expect(extractLeafSlugFromEntryId('campaigns/barry/lore/omens')).toBe('omens');
  });
});

describe('extractCampaignFamilySlugFromEntryId', () => {
  it('returns the entry slug for campaign family ids', () => {
    expect(extractCampaignFamilySlugFromEntryId('barry/lore/omens')).toBe('omens');
    expect(extractCampaignFamilySlugFromEntryId('campaigns/barry/lore/omens')).toBe('omens');
  });
});
