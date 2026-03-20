import fs from 'node:fs/promises';
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
});
