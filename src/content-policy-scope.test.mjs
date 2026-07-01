import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('campaign visibility policy scope', () => {
  it('keeps visibility out of the base schema and in campaign-domain schemas', async () => {
    const configPath = path.join(process.cwd(), 'src/content.config.ts');
    const source = await fs.readFile(configPath, 'utf8');

    const baseSchemaBlock = source.match(/const baseSchema = z\.object\(\{([\s\S]*?)\}\);/);
    expect(baseSchemaBlock).toBeTruthy();
    expect(baseSchemaBlock[1]).not.toContain('visibility:');

    const campaignsSchemaBlock = source.match(/const campaignsSchema = baseSchema\.extend\(\{([\s\S]*?)\}\);/);
    expect(campaignsSchemaBlock).toBeTruthy();
    expect(campaignsSchemaBlock[1]).toContain("visibility: z.enum(['public', 'campaignMembers', 'gm'])");
    expect(campaignsSchemaBlock[1]).toContain("default('gm')");

    expect(source).not.toContain('const sessionsSchema =');

    const campaignLoreSchemaBlock = source.match(/const campaignLoreSchema = baseSchema\.extend\(\{([\s\S]*?)\}\);/);
    expect(campaignLoreSchemaBlock).toBeTruthy();
    expect(campaignLoreSchemaBlock[1]).toContain("visibility: z.enum(['public', 'campaignMembers', 'gm'])");
    expect(campaignLoreSchemaBlock[1]).toContain("default('campaignMembers')");
  });
});
