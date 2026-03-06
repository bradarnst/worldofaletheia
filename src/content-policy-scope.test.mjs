import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('campaign visibility policy scope', () => {
  it('defines visibility only in campaign/session schemas', async () => {
    const configPath = path.join(process.cwd(), 'src/content.config.ts');
    const source = await fs.readFile(configPath, 'utf8');

    const baseSchemaBlock = source.match(/const baseSchema = z\.object\(\{([\s\S]*?)\}\);/);
    expect(baseSchemaBlock).toBeTruthy();
    expect(baseSchemaBlock[1]).not.toContain('visibility:');

    const campaignsSchemaBlock = source.match(/const campaignsSchema = baseSchema\.omit\(\{ status: true \}\)\.extend\(\{([\s\S]*?)\}\);/);
    expect(campaignsSchemaBlock).toBeTruthy();
    expect(campaignsSchemaBlock[1]).toContain("visibility: z.enum(['public', 'campaignMembers', 'gm'])");
    expect(campaignsSchemaBlock[1]).toContain("default('gm')");

    const sessionsSchemaBlock = source.match(/const sessionsSchema = baseSchema\.extend\(\{([\s\S]*?)\}\);/);
    expect(sessionsSchemaBlock).toBeTruthy();
    expect(sessionsSchemaBlock[1]).toContain("visibility: z.enum(['public', 'campaignMembers', 'gm'])");
    expect(sessionsSchemaBlock[1]).toContain("default('campaignMembers')");
  });
});
