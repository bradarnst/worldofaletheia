import { afterEach, describe, expect, it } from 'vitest';
import {
  clearContentLookupCache,
  parseContentLookupRows,
  parseWranglerJsonResults,
  resolveContentLookupTarget,
} from './content-index-loader.mjs';

describe('content index loader helpers', () => {
  afterEach(() => {
    clearContentLookupCache();
  });

  it('defaults build-time lookups to local D1 unless overridden', () => {
    expect(resolveContentLookupTarget({})).toEqual({
      mode: 'local',
      envName: null,
    });

    expect(resolveContentLookupTarget({
      CONTENT_LOADER_D1_MODE: 'remote',
      CONTENT_LOADER_D1_ENV: 'staging',
    })).toEqual({
      mode: 'remote',
      envName: 'staging',
    });
  });

  it('parses wrangler D1 JSON payloads', () => {
    const rows = parseWranglerJsonResults(JSON.stringify([
      {
        results: [{ id: 'lore/example', r2_key: 'content/lore/example.md' }],
        success: true,
      },
    ]));

    expect(rows).toEqual([{ id: 'lore/example', r2_key: 'content/lore/example.md' }]);
  });

  it('normalizes D1 lookup rows for the R2 loader', () => {
    expect(parseContentLookupRows([
      {
        id: 'brad/lore/omens',
        slug: 'omens',
        r2_key: 'content/campaigns/brad/lore/omens.md',
        visibility: 'campaignMembers',
        campaign_slug: 'brad',
      },
    ], 'campaignLore')).toEqual([
      {
        id: 'brad/lore/omens',
        slug: 'omens',
        r2Key: 'content/campaigns/brad/lore/omens.md',
        visibility: 'campaignMembers',
        campaignSlug: 'brad',
      },
    ]);
  });

  it('preserves collection-local ids without assuming cross-collection uniqueness', () => {
    expect(parseContentLookupRows([
      {
        id: 'shared/entry',
        slug: 'shared-entry',
        r2_key: 'content/lore/shared-entry.md',
        visibility: null,
        campaign_slug: null,
      },
    ], 'lore')).toEqual([
      {
        id: 'shared/entry',
        slug: 'shared-entry',
        r2Key: 'content/lore/shared-entry.md',
        visibility: undefined,
        campaignSlug: null,
      },
    ]);
  });

  it('rejects rows without required object lookup keys', () => {
    expect(() => parseContentLookupRows([{ id: 'lore/example', r2_key: '' }], 'lore')).toThrow(
      'missing required id/r2_key fields',
    );
  });
});
