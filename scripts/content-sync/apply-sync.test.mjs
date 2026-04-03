import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildWikiLinkIndexMock,
  transformObsidianLinksMock,
  syncCloudManifestsMock,
  syncContentIndexMock,
} = vi.hoisted(() => ({
  buildWikiLinkIndexMock: vi.fn(),
  transformObsidianLinksMock: vi.fn(),
  syncCloudManifestsMock: vi.fn(),
  syncContentIndexMock: vi.fn(),
}));

vi.mock('./obsidian-links.mjs', () => ({
  buildWikiLinkIndex: buildWikiLinkIndexMock,
  transformObsidianLinks: transformObsidianLinksMock,
}));

vi.mock('./manifests.mjs', () => ({
  syncCloudManifests: syncCloudManifestsMock,
}));

vi.mock('./content-index-writer.mjs', () => ({
  syncContentIndex: syncContentIndexMock,
}));

import { applySync } from './apply-sync.mjs';

async function createWorkspace() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-apply-sync-'));
  const sourceAbs = path.join(repoRoot, 'vault', 'lore', 'example.md');
  await fs.mkdir(path.dirname(sourceAbs), { recursive: true });
  await fs.writeFile(sourceAbs, '# Example\n', 'utf8');

  return {
    repoRoot,
    resolvedBackupRoot: path.join(repoRoot, '.content-backups'),
    sourceAbs,
  };
}

function createCloudDiff(sourceAbs) {
  return {
    grouped: {
      new: [
        {
          mapping: { target: 'cloud', to: 'lore' },
          sourceAbs,
          relativePath: 'example.md',
          cloudKey: 'lore/example.md',
        },
      ],
      updated: [],
      stale: [],
    },
  };
}

function createCloudServices() {
  return {
    cloud: {
      uploadText: vi.fn(),
      uploadFile: vi.fn(),
      deleteObject: vi.fn(),
      downloadObject: vi.fn(),
    },
  };
}

describe('applySync failure semantics', () => {
  const repoRoots = [];

  beforeEach(() => {
    buildWikiLinkIndexMock.mockReset();
    buildWikiLinkIndexMock.mockResolvedValue(new Map());
    transformObsidianLinksMock.mockReset();
    transformObsidianLinksMock.mockImplementation((sourceText) => sourceText);
    syncCloudManifestsMock.mockReset();
    syncContentIndexMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(repoRoots.splice(0).map((repoRoot) => fs.rm(repoRoot, { recursive: true, force: true })));
  });

  it('aborts publish before manifest sync when cloud object uploads fail', async () => {
    const config = await createWorkspace();
    repoRoots.push(config.repoRoot);
    const services = createCloudServices();
    services.cloud.uploadText.mockRejectedValue(new Error('network unavailable'));
    const diff = createCloudDiff(config.sourceAbs);
    diff.grouped.stale.push({
      mapping: { target: 'cloud', to: 'lore' },
      relativePath: 'obsolete.md',
      cloudKey: 'lore/obsolete.md',
    });

    await expect(applySync(diff, config, 'remove', services)).rejects.toMatchObject({
      supportCode: 'SYNC-CLOUD-OBJECTS-FAILED',
    });
    expect(services.cloud.deleteObject).not.toHaveBeenCalled();
    expect(syncCloudManifestsMock).not.toHaveBeenCalled();
  });

  it('fails with a dedicated support code when manifest publish fails', async () => {
    const config = await createWorkspace();
    repoRoots.push(config.repoRoot);
    const services = createCloudServices();
    services.cloud.uploadText.mockResolvedValue(undefined);
    syncCloudManifestsMock.mockRejectedValue(new Error('r2 manifest write failed'));

    await expect(applySync(createCloudDiff(config.sourceAbs), config, null, services)).rejects.toMatchObject({
      supportCode: 'SYNC-MANIFEST-PUBLISH-FAILED',
    });
  });

  it('fails with a dedicated support code when D1 index sync fails', async () => {
    const config = await createWorkspace();
    repoRoots.push(config.repoRoot);
    const services = createCloudServices();
    services.cloud.uploadText.mockResolvedValue(undefined);
    syncCloudManifestsMock.mockResolvedValue({
      writtenKeys: ['manifests/lore.json'],
      contentIndexRows: [],
      managedCollections: ['lore'],
    });
    syncContentIndexMock.mockRejectedValue(new Error('d1 unavailable'));

    await expect(applySync(createCloudDiff(config.sourceAbs), config, null, services)).rejects.toMatchObject({
      supportCode: 'SYNC-CONTENT-INDEX-FAILED',
    });
  });
});
