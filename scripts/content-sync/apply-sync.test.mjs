import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildWikiLinkIndexMock,
  transformObsidianLinksMock,
  collectCloudContentMetadataMock,
  syncContentIndexMock,
} = vi.hoisted(() => ({
  buildWikiLinkIndexMock: vi.fn(),
  transformObsidianLinksMock: vi.fn(),
  collectCloudContentMetadataMock: vi.fn(),
  syncContentIndexMock: vi.fn(),
}));

vi.mock('./obsidian-links.mjs', () => ({
  buildWikiLinkIndex: buildWikiLinkIndexMock,
  transformObsidianLinks: transformObsidianLinksMock,
}));

vi.mock('./cloud-content-metadata.mjs', () => ({
  collectCloudContentMetadata: collectCloudContentMetadataMock,
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
      uploadBytes: vi.fn(),
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
    collectCloudContentMetadataMock.mockReset();
    syncContentIndexMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(repoRoots.splice(0).map((repoRoot) => fs.rm(repoRoot, { recursive: true, force: true })));
  });

  it('aborts publish before metadata collection when cloud object uploads fail', async () => {
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
    expect(collectCloudContentMetadataMock).not.toHaveBeenCalled();
  });

  it('fails with a dedicated support code when D1 lookup metadata collection fails', async () => {
    const config = await createWorkspace();
    repoRoots.push(config.repoRoot);
    const services = createCloudServices();
    services.cloud.uploadText.mockResolvedValue(undefined);
    collectCloudContentMetadataMock.mockRejectedValue(new Error('content lookup rows unavailable'));

    await expect(applySync(createCloudDiff(config.sourceAbs), config, null, services)).rejects.toMatchObject({
      supportCode: 'SYNC-CONTENT-INDEX-FAILED',
    });
    expect(syncContentIndexMock).not.toHaveBeenCalled();
  });

  it('fails with a dedicated support code when D1 index sync fails', async () => {
    const config = await createWorkspace();
    repoRoots.push(config.repoRoot);
    const services = createCloudServices();
    services.cloud.uploadText.mockResolvedValue(undefined);
    collectCloudContentMetadataMock.mockResolvedValue({
      contentIndexRows: [],
      managedCollections: ['lore'],
    });
    syncContentIndexMock.mockRejectedValue(new Error('d1 unavailable'));

    await expect(applySync(createCloudDiff(config.sourceAbs), config, null, services)).rejects.toMatchObject({
      supportCode: 'SYNC-CONTENT-INDEX-FAILED',
    });
  });
});
