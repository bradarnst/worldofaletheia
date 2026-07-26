import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Campaign Content ownership boundary', () => {
  it('keeps Campaign Content out of static Astro collections', async () => {
    const configPath = path.join(process.cwd(), 'src/content.config.ts');
    const source = await fs.readFile(configPath, 'utf8');

    const baseSchemaBlock = source.match(/const baseSchema = z\.object\(\{([\s\S]*?)\}\);/);
    expect(baseSchemaBlock).toBeTruthy();
    expect(baseSchemaBlock[1]).not.toContain('visibility:');

    expect(source).not.toMatch(/const campaignsSchema\s*=/);
    expect(source).not.toMatch(/const campaign[A-Z]\w*Schema\s*=/);
    expect(source).not.toContain("createMarkdownLoader('campaigns'");
    expect(source).not.toContain("'src/content/campaigns'");
    expect(source).not.toMatch(/\b(?:campaigns|sessions|campaignLore|campaignPlaces|campaignSentients|campaignBestiary|campaignFlora|campaignFactions|campaignSystems|campaignMeta|campaignCharacters|campaignScenes|campaignAdventures|campaignHooks),?\n/);
  });

  it('does not expose legacy campaign family or direct-media routes', async () => {
    const legacyRoutePaths = [
      'src/pages/campaigns/[campaign]/[family]/index.astro',
      'src/pages/campaigns/[campaign]/[family]/[...slug].astro',
      'src/pages/api/campaign-media/[campaign]/images/[variant]/[...asset].ts',
    ];

    await expect(Promise.all(legacyRoutePaths.map(async (routePath) => {
      await fs.access(path.join(process.cwd(), routePath));
    }))).rejects.toThrow();
  });
});
