import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCampaignImageVariantUploads,
  getCampaignImageVariantPlan,
} from './campaign-media-variants.mjs';

describe('campaign media variants', () => {
  const tempPaths = [];

  afterEach(async () => {
    await Promise.all(tempPaths.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
  });

  it('builds variant paths for campaign originals only', () => {
    expect(getCampaignImageVariantPlan('brad/assets/images/original/maps/keep.png')).toMatchObject({
      campaignSlug: 'brad',
      assetPath: 'maps/keep.png',
      originalRelativePath: 'brad/assets/images/original/maps/keep.png',
    });
    expect(getCampaignImageVariantPlan('brad/assets/images/maps/keep.png')).toBeNull();
    expect(getCampaignImageVariantPlan('brad/assets/docs/original/handout.pdf')).toBeNull();
  });

  it('renders upload payloads for each configured variant', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-campaign-variants-'));
    tempPaths.push(tempDir);
    const sourceAbs = path.join(tempDir, 'keep.png');
    await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 120, g: 80, b: 40 },
      },
    }).png().toFile(sourceAbs);

    const plan = getCampaignImageVariantPlan('brad/assets/images/original/maps/keep.png');
    if (!plan) {
      throw new Error('expected variant plan');
    }

    const uploads = await buildCampaignImageVariantUploads(sourceAbs, plan);

    expect(uploads.map((upload) => upload.variant)).toEqual(['thumb', 'detail', 'fullscreen']);
    expect(uploads.map((upload) => upload.relativePath)).toEqual([
      'brad/assets/images/variants/thumb/maps/keep.png',
      'brad/assets/images/variants/detail/maps/keep.png',
      'brad/assets/images/variants/fullscreen/maps/keep.png',
    ]);
    expect(uploads.every((upload) => upload.body.length > 0)).toBe(true);
  });
});
