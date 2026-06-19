import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSyncDiff } from './fs-diff.mjs';

describe('buildSyncDiff', () => {
  it('includes local cleanup files as stale for cloud mappings', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-diff-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    const repoRoot = path.join(tempRoot, 'repo');

    await fs.mkdir(path.join(vaultRoot, 'lore'), { recursive: true });
    await fs.mkdir(path.join(repoRoot, 'src/content/lore'), { recursive: true });
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'entry.md'),
      '---\ntitle: Test\ntype: lore\nstatus: draft\nauthor: Brad\n---\n',
      'utf8',
    );
    await fs.writeFile(path.join(repoRoot, 'src/content/lore', 'legacy.md'), 'legacy', 'utf8');

    const diff = await buildSyncDiff(
      {
        vaultRoot,
        repoRoot,
        includeExtensions: ['.md'],
        mappings: [
          {
            from: 'lore',
            to: 'lore',
            target: 'cloud',
            localCleanupPath: 'src/content/lore',
          },
        ],
      },
      {
        cloud: {
          listObjects: async () => new Map(),
        },
      },
    );

    expect(diff.grouped.new).toHaveLength(1);
    expect(diff.grouped.stale).toHaveLength(1);
    expect(diff.grouped.stale[0].destAbs).toContain(path.join('src', 'content', 'lore', 'legacy.md'));
    expect(diff.grouped.stale[0].staleReason).toBe('localCleanup');
  });

  it('excludes preview markdown from production cloud diffs', async () => {
    const previousMode = process.env.CONTENT_INDEX_SYNC_MODE;
    const previousEnv = process.env.CONTENT_INDEX_SYNC_ENV;
    process.env.CONTENT_INDEX_SYNC_MODE = 'remote';
    process.env.CONTENT_INDEX_SYNC_ENV = '';

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-diff-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    const repoRoot = path.join(tempRoot, 'repo');
    await fs.mkdir(path.join(vaultRoot, 'lore'), { recursive: true });
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'preview.md'),
      '---\ntitle: Preview\ncollection: lore\ntype: history\npublication: preview\nauthors:\n  - brad\n---\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(vaultRoot, 'lore', 'published.md'),
      '---\ntitle: Published\ncollection: lore\ntype: history\npublication: publish\nauthors:\n  - brad\n---\n',
      'utf8',
    );

    try {
      const diff = await buildSyncDiff(
        {
          vaultRoot,
          repoRoot,
          includeExtensions: ['.md'],
          mappings: [{ from: 'lore', to: 'lore', target: 'cloud' }],
        },
        {
          cloud: {
            listObjects: async () => new Map(),
          },
        },
      );

      expect(diff.grouped.new.map((record) => record.relativePath)).toEqual(['published.md']);
      expect(diff.grouped.excludedByPublication.map((record) => record.relativePath)).toEqual(['preview.md']);
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

  it('matches campaign family rows against their D1 collection source etags', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-diff-'));
    const vaultRoot = path.join(tempRoot, 'vault');
    const repoRoot = path.join(tempRoot, 'repo');
    const relativePath = 'barry/lore/Test Entry.md';
    const markdown = '---\ntitle: Test Entry\ncollection: campaignLore\npublication: publish\nauthors:\n  - brad\n---\nBody\n';

    await fs.mkdir(path.join(vaultRoot, 'campaigns', 'barry', 'lore'), { recursive: true });
    await fs.writeFile(path.join(vaultRoot, 'campaigns', relativePath), markdown, 'utf8');

    const diff = await buildSyncDiff(
      {
        vaultRoot,
        repoRoot,
        includeExtensions: ['.md'],
        mappings: [{ from: 'campaigns', to: 'campaigns', target: 'cloud' }],
      },
      {
        cloud: {
          listObjects: async () => new Map([[relativePath, { etag: 'non-md5-etag', size: 1 }]]),
        },
      },
      {
        previousEtags: new Map([
          ['campaignLore:barry/lore/Test Entry', createHash('md5').update(markdown).digest('hex')],
        ]),
        wikiIndex: new Map(),
      },
    );

    expect(diff.grouped.unchanged.map((record) => record.relativePath)).toEqual([relativePath]);
    expect(diff.grouped.updated).toHaveLength(0);
  });
});
