import { describe, expect, it } from 'vitest';
import { deriveCollectionEntries } from './cloud-content-metadata.mjs';

function createCloudMock() {
  return {
    buildKey(to, relativePath) {
      return `${to}/${relativePath}`;
    },
  };
}

describe('deriveCollectionEntries', () => {
  it('indexes legacy top-level campaign overview filenames as campaigns entries', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'campaigns' },
      'brad/Campaign - Brad.md',
      `---
title: Campaign - Brad
slug: brad
visibility: public
---

Legacy campaign overview body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].contentEntry).toMatchObject({
      collection: 'campaigns',
      id: 'brad/Campaign - Brad',
      slug: 'brad',
      campaignSlug: 'brad',
      r2Key: 'campaigns/brad/Campaign - Brad.md',
    });
    expect(entries[0].contentIndexRow).toMatchObject({
      collection: 'campaigns',
      id: 'brad/Campaign - Brad',
      slug: 'brad',
      visibility: 'public',
      r2Key: 'campaigns/brad/Campaign - Brad.md',
    });
  });

  it('continues to prefer index.md campaign overviews', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'campaigns' },
      'barry/index.md',
      `---
title: Campaign - Barry
visibility: public
---

Preferred campaign overview body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].contentEntry).toMatchObject({
      collection: 'campaigns',
      id: 'barry/index',
      slug: 'barry',
      campaignSlug: 'barry',
      r2Key: 'campaigns/barry/index.md',
    });
  });
});
