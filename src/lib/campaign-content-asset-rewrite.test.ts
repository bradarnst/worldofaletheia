// src/lib/campaign-content-asset-rewrite.test.ts
import { describe, expect, it } from 'vitest';
import {
  isValidCampaignContentAssetPath,
  mapCampaignAssetReferenceToMainSite,
  rewriteCampaignContentAssetReferences,
} from '~/lib/campaign-content-asset-rewrite';

const WOA_ADMIN = 'https://woa-admin.example.invalid';

describe('isValidCampaignContentAssetPath', () => {
  it('accepts bucket-relative asset paths', () => {
    expect(isValidCampaignContentAssetPath('assets/hero.png')).toBe(true);
    expect(isValidCampaignContentAssetPath('assets/maps/region.png')).toBe(true);
  });

  it('rejects paths that are not under assets/', () => {
    expect(isValidCampaignContentAssetPath('hero.png')).toBe(false);
    expect(isValidCampaignContentAssetPath('/assets/hero.png')).toBe(false);
  });

  it('enforces the contract length bounds (8-512 characters)', () => {
    expect(isValidCampaignContentAssetPath('assets/')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets/a')).toBe(true);
    expect(isValidCampaignContentAssetPath(`assets/${'x'.repeat(600)}`)).toBe(false);
  });

  it('rejects traversal, empty segments, backslashes, and markdown', () => {
    expect(isValidCampaignContentAssetPath('assets/../secret.png')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets//double.png')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets/foo\\bar.png')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets/notes.md')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets/.')).toBe(false);
    expect(isValidCampaignContentAssetPath('assets/..')).toBe(false);
  });
});

describe('mapCampaignAssetReferenceToMainSite', () => {
  it('maps the woa-admin asset endpoint query form to a main-site URL', () => {
    expect(mapCampaignAssetReferenceToMainSite(`${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/hero.png`, 'brad')).toBe(
      '/campaigns/brad/assets/hero.png',
    );
  });

  it('maps a relative woa-admin asset endpoint path', () => {
    expect(mapCampaignAssetReferenceToMainSite('/api/v1/campaigns/brad/assets?path=assets/maps/region.png', 'brad')).toBe(
      '/campaigns/brad/assets/maps/region.png',
    );
  });

  it('maps bucket-relative asset references', () => {
    expect(mapCampaignAssetReferenceToMainSite('assets/hero.png', 'brad')).toBe('/campaigns/brad/assets/hero.png');
    expect(mapCampaignAssetReferenceToMainSite('./assets/hero.png', 'brad')).toBe('/campaigns/brad/assets/hero.png');
    expect(mapCampaignAssetReferenceToMainSite('/assets/hero.png', 'brad')).toBe('/campaigns/brad/assets/hero.png');
  });

  it('preserves percent-encoded segments when mapping', () => {
    expect(mapCampaignAssetReferenceToMainSite(`${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/my%20map.png`, 'brad')).toBe(
      '/campaigns/brad/assets/my%20map.png',
    );
  });

  it('keeps cross-campaign asset endpoint URLs scoped to the current campaign', () => {
    expect(mapCampaignAssetReferenceToMainSite(`${WOA_ADMIN}/api/v1/campaigns/barry/assets?path=assets/hero.png`, 'brad')).toBe(
      '/campaigns/brad/assets/hero.png',
    );
  });

  it('returns null for malformed percent-encoded relative paths', () => {
    expect(mapCampaignAssetReferenceToMainSite('assets/%ZZ.png', 'brad')).toBeNull();
  });

  it('returns null for non-asset URLs', () => {
    expect(mapCampaignAssetReferenceToMainSite('https://example.com/foo.png', 'brad')).toBeNull();
    expect(mapCampaignAssetReferenceToMainSite(`${WOA_ADMIN}/api/v1/campaigns/brad/campaign-content`, 'brad')).toBeNull();
    expect(mapCampaignAssetReferenceToMainSite(`${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/notes.md`, 'brad')).toBeNull();
  });
});

describe('rewriteCampaignContentAssetReferences', () => {
  it('rewrites markdown image references to the main-site asset route', () => {
    const markdown = `![Battle map](${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/map.png)`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      '![Battle map](/campaigns/brad/assets/map.png)',
    );
  });

  it('rewrites markdown link references', () => {
    const markdown = `[Handout](${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/handout.pdf)`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      '[Handout](/campaigns/brad/assets/handout.pdf)',
    );
  });

  it('rewrites bucket-relative asset references', () => {
    const markdown = 'See ![diagram](assets/diagram.png) for context.';
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      'See ![diagram](/campaigns/brad/assets/diagram.png) for context.',
    );
  });

  it('rewrites inline HTML img and anchor asset references', () => {
    const markdown = `<img src="${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/poster.png"><a href="assets/poster.png">poster</a>`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      '<img src="/campaigns/brad/assets/poster.png"><a href="/campaigns/brad/assets/poster.png">poster</a>',
    );
  });

  it('rewrites single-quoted inline HTML asset references', () => {
    const markdown = `<img src='${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/poster.png'><a href='assets/poster.png'>poster</a>`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      "<img src='/campaigns/brad/assets/poster.png'><a href='/campaigns/brad/assets/poster.png'>poster</a>",
    );
  });

  it('rewrites reference-style markdown asset definitions', () => {
    const markdown = `[Map][map-ref]\n\n[map-ref]: ${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/map.png "Battle map"`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      '[Map][map-ref]\n\n[map-ref]: /campaigns/brad/assets/map.png "Battle map"',
    );
  });

  it('leaves non-asset URLs untouched', () => {
    const markdown = '[External](https://example.com/page) and ![x](https://cdn.example.com/x.png)';
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(markdown);
  });

  it('neutralizes unsafe source asset paths instead of exposing the source origin', () => {
    const markdown = `![leak](${WOA_ADMIN}/api/v1/campaigns/brad/assets?path=assets/../secret.png)`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe('![leak](#)');
  });

  it('neutralizes non-asset source links while preserving unrelated external links', () => {
    const markdown = `[source](${WOA_ADMIN}/internal) and [external](https://example.com/page)`;
    expect(rewriteCampaignContentAssetReferences(markdown, { campaignSlug: 'brad' })).toBe(
      '[source](#) and [external](https://example.com/page)',
    );
  });
});
