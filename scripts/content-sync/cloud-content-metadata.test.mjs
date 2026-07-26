import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectCloudContentMetadata, deriveCollectionEntries } from './cloud-content-metadata.mjs';

function createCloudMock() {
  return {
    buildKey(to, relativePath) {
      return `${to}/${relativePath}`;
    },
  };
}

const TIMESTAMP_FIELDS = `createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
`;

function withTimestamps(frontmatter) {
  if (!frontmatter.includes('createdAt:') && !frontmatter.includes('updatedAt:')) {
    return `${frontmatter.trimEnd()}\n${TIMESTAMP_FIELDS}`;
  }
  return frontmatter;
}

describe('deriveCollectionEntries', () => {
  it('rejects metadata derivation for retired campaign and session mappings', async () => {
    for (const mapping of [{ to: 'campaigns' }, { to: 'sessions' }, { to: 'notes', collection: 'campaignNotes' }]) {
      await expect(
        deriveCollectionEntries(
          mapping,
          'legacy.md',
          '---\ntitle: Legacy\ncollection: lore\n---\n',
          { mtime: new Date('2026-04-06T12:00:00.000Z') },
          createCloudMock(),
          '2026-04-06T12:30:00.000Z',
        ),
      ).rejects.toThrow('Retired Campaign Content mapping');
    }
  });

  it('derives Using Aletheia rows from non-campaign mappings', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'systems' },
      'gurps/combat.md',
      `---
title: GURPS Combat
collection: systems
type: rules
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Combat rules body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].contentEntry).toMatchObject({
      collection: 'systems',
      id: 'gurps/combat',
      slug: 'gurps/combat',
      campaignSlug: null,
      r2Key: 'systems/gurps/combat.md',
    });
    expect(entries[0].contentSearchRow).toMatchObject({
      collection: 'systems',
      id: 'gurps/combat',
      slug: 'gurps/combat',
      bodyText: 'Combat rules body.',
    });
  });

  it('truncates oversized body text for stable FTS sync statements', async () => {
    const oversizedBody = `---
title: Long Entry
collection: lore
authors:
  - brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
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
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Joined author body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contentIndexRow.author).toBe('brad, barry');
    expect(entries[0].contentIndexRow.publication).toBe('publish');
    expect(entries[0].contentIndexRow.contentState).toBe('stable');
    expect(entries[0].contentIndexRow.audienceWarningsJson).toBe('[]');
  });

  it('derives publication metadata and label-only audience warnings', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'lore' },
      'gm-preview.md',
      `---
title: GM Preview
collection: lore
type: history
publication: preview
contentState: unfinished
audienceWarnings:
  - gmSpoilers
authors:
  - brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Spoiler body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contentIndexRow).toMatchObject({
      publication: 'preview',
      contentState: 'unfinished',
      audienceWarningsJson: '["gmSpoilers"]',
    });
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
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
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
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Profile body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contributorRegistryRow).toEqual({
      id: 'alex',
      aliases: ['Alex'],
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
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
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
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow('wrong-collection.md frontmatter collection "places" does not match sync mapping/folder collection "lore".');
  });

  it('canonicalizes attribution contributor ids through contributor profile aliases', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-metadata-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    await fs.mkdir(path.join(vaultRoot, 'lore'), { recursive: true });
    await fs.mkdir(path.join(vaultRoot, 'contributors'), { recursive: true });

    await fs.writeFile(
      path.join(vaultRoot, 'contributors', 'Brad Arnst.md'),
      `---
title: Brad Arnst
collection: contributors
status: publish
profileMode: featured
aliases:
  - Brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Contributor profile.
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'Example.md'),
      `---
title: Example
collection: lore
type: history
status: publish
authors:
  - Brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Example body.
`,
      'utf8',
    );

    const metadata = await collectCloudContentMetadata(
      {
        repoRoot: tempRoot,
        vaultRoot,
        includeExtensions: ['.md'],
        mappings: [
          { from: 'lore', to: 'lore', target: 'cloud', localCleanupPath: 'src/content/lore' },
          { from: 'contributors', to: 'contributors', target: 'cloud', localCleanupPath: 'src/content/contributors' },
        ],
      },
      { cloud: createCloudMock() },
      new Map(),
    );

    expect(metadata.contributorRows[0]).toMatchObject({
      id: 'Brad Arnst',
      aliases: ['Brad'],
    });
    expect(metadata.attributionRows).toContainEqual(expect.objectContaining({
      contributorId: 'Brad Arnst',
      role: 'author',
      targetCollection: 'lore',
      targetId: 'Example',
    }));
  });

  it('canonicalizes attribution contributor ids through contributor display-name first tokens', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-metadata-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    await fs.mkdir(path.join(vaultRoot, 'lore'), { recursive: true });
    await fs.mkdir(path.join(vaultRoot, 'contributors'), { recursive: true });

    await fs.writeFile(
      path.join(vaultRoot, 'contributors', 'Brad Arnst.md'),
      `---
title: Brad Arnst
displayName: Brad Arnst
collection: contributors
status: publish
profileMode: featured
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Contributor profile.
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'Example.md'),
      `---
title: Example
collection: lore
type: history
status: publish
authors:
  - Brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Example body.
`,
      'utf8',
    );

    const metadata = await collectCloudContentMetadata(
      {
        repoRoot: tempRoot,
        vaultRoot,
        includeExtensions: ['.md'],
        mappings: [
          { from: 'lore', to: 'lore', target: 'cloud', localCleanupPath: 'src/content/lore' },
          { from: 'contributors', to: 'contributors', target: 'cloud', localCleanupPath: 'src/content/contributors' },
        ],
      },
      { cloud: createCloudMock() },
      new Map(),
    );

    expect(metadata.contributorRows[0]).toMatchObject({
      id: 'Brad Arnst',
      aliases: ['Brad'],
    });
    expect(metadata.attributionRows).toContainEqual(expect.objectContaining({
      contributorId: 'Brad Arnst',
      role: 'author',
    }));
  });

  it('excludes preview content from production content index metadata', async () => {
    const previousMode = process.env.CONTENT_INDEX_SYNC_MODE;
    const previousEnv = process.env.CONTENT_INDEX_SYNC_ENV;
    process.env.CONTENT_INDEX_SYNC_MODE = 'remote';
    process.env.CONTENT_INDEX_SYNC_ENV = '';

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-metadata-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    await fs.mkdir(path.join(vaultRoot, 'lore'), { recursive: true });

    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'Preview.md'),
      `---
title: Preview
collection: lore
type: history
publication: preview
contentState: unfinished
audienceWarnings: []
authors:
  - brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Preview body.
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'Published.md'),
      `---
title: Published
collection: lore
type: history
publication: publish
contentState: stable
audienceWarnings: []
authors:
  - brad
createdAt: '2026-04-06T10:00:00.000Z'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Published body.
`,
      'utf8',
    );

    try {
      const metadata = await collectCloudContentMetadata(
        {
          repoRoot: tempRoot,
          vaultRoot,
          includeExtensions: ['.md'],
          mappings: [{ from: 'lore', to: 'lore', target: 'cloud', localCleanupPath: 'src/content/lore' }],
        },
        { cloud: createCloudMock() },
        new Map(),
      );

      expect(metadata.managedCollections).toEqual(['lore']);
      expect(metadata.contentIndexRows.map((row) => row.slug)).toEqual(['Published']);
    } finally {
      if (previousMode === undefined) {
        delete process.env.CONTENT_INDEX_SYNC_MODE;
      } else {
        process.env.CONTENT_INDEX_SYNC_MODE = previousMode;
      }
      if (previousEnv === undefined) {
        delete process.env.CONTENT_INDEX_SYNC_ENV;
      } else {
        process.env.CONTENT_INDEX_SYNC_ENV = previousEnv;
      }
    }
  });

  it('accepts createdAt/updatedAt as RFC 3339 with explicit numeric offset', async () => {
    const entries = await deriveCollectionEntries(
      { to: 'lore' },
      'offset-date.md',
      `---
title: Offset Date
collection: lore
type: history
authors:
  - brad
createdAt: '2026-04-06T12:00:00+02:00'
updatedAt: '2026-04-06T14:30:00+02:00'
---

Offset body.
`,
      { mtime: new Date('2026-04-06T12:00:00.000Z') },
      createCloudMock(),
      '2026-04-06T12:30:00.000Z',
    );

    expect(entries[0].contentIndexRow.createdAt).toBe('2026-04-06T10:00:00.000Z');
    expect(entries[0].contentIndexRow.updatedAt).toBe('2026-04-06T12:30:00.000Z');
  });

  it('rejects missing createdAt in frontmatter', async () => {
    await expect(
      deriveCollectionEntries(
        { to: 'lore' },
        'missing-created.md',
        `---
title: Missing Created
collection: lore
type: history
authors:
  - brad
updatedAt: '2026-04-06T12:00:00.000Z'
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow("missing-created missing required RFC 3339 frontmatter field 'createdAt'.");
  });

  it('rejects missing updatedAt in frontmatter', async () => {
    await expect(
      deriveCollectionEntries(
        { to: 'lore' },
        'missing-updated.md',
        `---
title: Missing Updated
collection: lore
type: history
authors:
  - brad
createdAt: '2026-04-06T12:00:00.000Z'
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow("missing-updated missing required RFC 3339 frontmatter field 'updatedAt'.");
  });

  it('rejects non-RFC-3339 createdAt values', async () => {
    await expect(
      deriveCollectionEntries(
        { to: 'lore' },
        'loose-date.md',
        `---
title: Loose Date
collection: lore
type: history
authors:
  - brad
createdAt: '2026-04-06 12:00:00'
updatedAt: '2026-04-06T12:00:00.000Z'
---

Body.
`,
        { mtime: new Date('2026-04-06T12:00:00.000Z') },
        createCloudMock(),
        '2026-04-06T12:30:00.000Z',
      ),
    ).rejects.toThrow(/Expected strict RFC 3339 date-time with offset, received: 2026-04-06 12:00:00/);
  });
});
