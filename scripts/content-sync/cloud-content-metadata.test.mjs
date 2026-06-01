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
collection: campaigns
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
    expect(entries[0].contentSearchRow).toMatchObject({
      collection: 'campaigns',
      id: 'brad/Campaign - Brad',
      slug: 'brad',
      title: 'Campaign - Brad',
      bodyText: 'Legacy campaign overview body.',
    });
  });

  it('continues to prefer index.md campaign overviews', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'campaigns' },
      'barry/index.md',
      `---
title: Campaign - Barry
collection: campaigns
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
    expect(entries[0].contentSearchRow).toMatchObject({
      collection: 'campaigns',
      id: 'barry/index',
      slug: 'barry',
      bodyText: 'Preferred campaign overview body.',
    });
  });

  it('truncates oversized body text for stable FTS sync statements', async () => {
    const oversizedBody = `---
title: Long Entry
collection: lore
authors:
  - brad
---

${'lorem ipsum '.repeat(5000)}
`;

    const entries = await deriveCollectionEntries(
      { to: 'lore' },
      'Long Entry.md',
      oversizedBody,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contentSearchRow.bodyText.length).toBeLessThanOrEqual(32000);
  });

  it('derives legacy content_index author display text from authors arrays', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'lore' },
      'contributors-test.md',
      `---
title: Contributors Test
collection: lore
type: history
status: publish
authors:
  - brad
  - barry
---

Joined author body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contentIndexRow.author).toBe('brad, barry');
  });

  it('derives multi-author and multi-role attribution rows without source JSON fields', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'lore' },
      'contributors-test.md',
      `---
title: Contributors Test
collection: lore
type: history
status: publish
authors:
  - brad
  - barry
contributors:
  - id: alex
    roles:
      - artist
      - cartographer
  - id: alex
    roles:
      - artist
---

Attribution body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].attributionRows).toEqual([
      {
        contributorId: 'alex',
        targetType: 'content',
        targetCollection: 'lore',
        targetId: 'contributors-test',
        role: 'artist',
        indexedAt: '2026-04-06T12:30:00.000Z',
      },
      {
        contributorId: 'alex',
        targetType: 'content',
        targetCollection: 'lore',
        targetId: 'contributors-test',
        role: 'cartographer',
        indexedAt: '2026-04-06T12:30:00.000Z',
      },
      {
        contributorId: 'barry',
        targetType: 'content',
        targetCollection: 'lore',
        targetId: 'contributors-test',
        role: 'author',
        indexedAt: '2026-04-06T12:30:00.000Z',
      },
      {
        contributorId: 'brad',
        targetType: 'content',
        targetCollection: 'lore',
        targetId: 'contributors-test',
        role: 'author',
        indexedAt: '2026-04-06T12:30:00.000Z',
      },
    ]);
    expect(entries[0].contentIndexRow).not.toHaveProperty('contributorsJson');
    expect(entries[0].contentIndexRow).not.toHaveProperty('attributionsJson');
  });

  it('derives contributor registry rows from contributor profile markdown', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'contributors' },
      'alex.md',
      `---
title: Alex Example
collection: contributors
displayName: Alex E.
status: publish
profileMode: standard
bioExcerpt: Makes maps.
avatar: /assets/images/contributors/alex.jpg
---

Profile body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contributorRegistryRow).toEqual({
      id: 'alex',
      displayName: 'Alex E.',
      title: 'Alex Example',
      status: 'publish',
      profileMode: 'standard',
      bioExcerpt: 'Makes maps.',
      avatar: '/assets/images/contributors/alex.jpg',
      sourceId: 'alex',
      r2Key: 'contributors/alex.md',
      indexedAt: '2026-04-06T12:30:00.000Z',
    });
    expect(entries[0].attributionRows).toEqual([]);
  });

  it('rejects missing frontmatter collection during metadata derivation', async () => {
    await expect(
      deriveCollectionEntries(
        { to: 'lore' },
        'missing-collection.md',
        `---
title: Missing Collection
type: history
status: publish
authors:
  - brad
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow('missing-collection.md missing required frontmatter collection.');
  });

  it('rejects frontmatter collection mismatches during metadata derivation', async () => {
    await expect(
      deriveCollectionEntries(
        { to: 'lore' },
        'wrong-collection.md',
        `---
title: Wrong Collection
collection: places
type: history
status: publish
authors:
  - brad
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow('wrong-collection.md frontmatter collection "places" does not match sync mapping/folder collection "lore".');
  });
});
