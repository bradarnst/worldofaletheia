import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCampaignImageVariantUploads, getCampaignImageVariantPlan } from './campaign-media-variants.mjs';
import { buildWikiLinkIndex, transformObsidianLinks } from './obsidian-links.mjs';
import { syncContentDiscovery } from './content-discovery-writer.mjs';
import { collectCloudContentMetadata } from './cloud-content-metadata.mjs';
import { SupportCodeError } from './utils.mjs';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function normalizeSafeRelativePath(relativePath, contextLabel) {
  const normalized = String(relativePath || '').trim().split('\\').join('/').replace(/^\/+/, '');
  if (!normalized) {
    throw new Error(`Invalid empty relative path for ${contextLabel}.`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe relative path for ${contextLabel}: ${relativePath}`);
  }

  return normalized;
}

function resolveBackupTarget(baseRoot, mappingTarget, relativePath, contextLabel) {
  const safeRelative = normalizeSafeRelativePath(relativePath, contextLabel);
  const base = path.resolve(baseRoot, mappingTarget);
  const target = path.resolve(base, safeRelative);
  const rel = path.relative(base, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write backup outside backup root for ${contextLabel}.`);
  }
  return target;
}

function contentTypeForExtension(ext) {
  switch (ext) {
    case '.md':
      return 'text/markdown';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function resolveCloudMirrorDestination(config, mapping, relativePath) {
  const cleanupRoot = mapping.localCleanupPath
    ? path.resolve(config.repoRoot, mapping.localCleanupPath)
    : path.resolve(config.repoRoot, 'src/content', mapping.to);
  return path.resolve(cleanupRoot, relativePath);
}

async function uploadCloudRecord({ rec, config, wikiIndex, cloud }) {
  const sourceExt = path.extname(rec.sourceAbs).toLowerCase();
  const contentType = contentTypeForExtension(sourceExt);

  if (sourceExt === '.md') {
    const sourceText = await fs.readFile(rec.sourceAbs, 'utf8');
    const transformed = transformObsidianLinks(sourceText, {
      destAbs: resolveCloudMirrorDestination(config, rec.mapping, rec.relativePath),
      repoRoot: config.repoRoot,
      wikiIndex,
    });
    const key = await cloud.uploadText(rec.cloudKey, transformed, contentType);
    return [key];
  }

  const uploadedKeys = [await cloud.uploadFile(rec.mapping.to, rec.relativePath, rec.sourceAbs, contentType)];
  const variantPlan = getCampaignImageVariantPlan(rec.relativePath);
  if (!variantPlan) {
    return uploadedKeys;
  }

  const variantUploads = await buildCampaignImageVariantUploads(rec.sourceAbs, variantPlan);
  for (const variantUpload of variantUploads) {
    const key = cloud.buildKey(rec.mapping.to, variantUpload.relativePath);
    await cloud.uploadBytes(key, variantUpload.body, variantUpload.contentType);
    uploadedKeys.push(key);
  }

  return uploadedKeys;
}

async function deleteCloudRecord(mapping, relativePath, cloud) {
  const deletedKeys = [await cloud.deleteObject(mapping.to, relativePath)];
  const variantPlan = getCampaignImageVariantPlan(relativePath);
  if (!variantPlan) {
    return deletedKeys;
  }

  for (const variant of variantPlan.variants) {
    deletedKeys.push(await cloud.deleteObject(mapping.to, variant.relativePath));
  }

  return deletedKeys;
}

export async function applySync(diff, config, staleAction, services = {}) {
  const changedFiles = [];
  const backupSession = timestamp();
  const backupRootForRun = path.resolve(config.resolvedBackupRoot, backupSession);
  const wikiIndex = await buildWikiLinkIndex(config.repoRoot);
  const cloud = services.cloud || null;
  const cloudOperationFailures = [];

  for (const rec of [...diff.grouped.new, ...diff.grouped.updated]) {
    if (rec.mapping.target === 'repo') {
      await ensureParent(rec.destAbs);
      const sourceExt = path.extname(rec.sourceAbs).toLowerCase();
      if (sourceExt === '.md') {
        const sourceText = await fs.readFile(rec.sourceAbs, 'utf8');
        const transformed = transformObsidianLinks(sourceText, {
          destAbs: rec.destAbs,
          repoRoot: config.repoRoot,
          wikiIndex,
        });
        await fs.writeFile(rec.destAbs, transformed, 'utf8');
      } else {
        await fs.copyFile(rec.sourceAbs, rec.destAbs);
      }
      changedFiles.push(rec.destAbs);
      continue;
    }

    if (!cloud) {
      throw new Error('Cloud mappings require content cloud configuration.');
    }

    try {
      const uploadedKeys = await uploadCloudRecord({ rec, config, wikiIndex, cloud });
      changedFiles.push(...uploadedKeys.map((key) => `cloud:${key}`));
    } catch (uploadError) {
      console.error(`Cloud upload failed for ${rec.cloudKey}:`, uploadError.message);
      cloudOperationFailures.push(`upload ${rec.cloudKey}`);
    }
  }

  if (cloud && cloudOperationFailures.length > 0) {
    throw new SupportCodeError(
      'SYNC-CLOUD-OBJECTS-FAILED',
      `Cloud publish aborted after ${cloudOperationFailures.length} object failure(s): ${cloudOperationFailures.join(', ')}`,
    );
  }

  if (staleAction === 'remove') {
    for (const rec of diff.grouped.stale) {
      if (rec.destAbs) {
        await fs.rm(rec.destAbs, { force: true });
        changedFiles.push(rec.destAbs);
        continue;
      }

      if (!cloud) {
        throw new Error('Cloud mappings require content cloud configuration.');
      }

      const deletedKeys = await deleteCloudRecord(rec.mapping, rec.relativePath, cloud);
      changedFiles.push(...deletedKeys.map((key) => `cloud:${key}`));
    }
  }

  if (staleAction === 'backup') {
    for (const rec of diff.grouped.stale) {
      if (rec.destAbs) {
        const backupBase = rec.mapping.localCleanupPath || rec.mapping.to;
        const backupTarget = path.resolve(backupRootForRun, backupBase, rec.relativePath);
        await ensureParent(backupTarget);
        await fs.copyFile(rec.destAbs, backupTarget);
        await fs.rm(rec.destAbs, { force: true });
        changedFiles.push(rec.destAbs, backupTarget);
        continue;
      }

      if (!cloud) {
        throw new Error('Cloud mappings require content cloud configuration.');
      }

      const backupTarget = resolveBackupTarget(
        backupRootForRun,
        rec.mapping.to,
        rec.relativePath,
        rec.cloudKey || rec.relativePath,
      );
      await ensureParent(backupTarget);
      await cloud.downloadObject(rec.mapping.to, rec.relativePath, backupTarget);
      const deletedKeys = await deleteCloudRecord(rec.mapping, rec.relativePath, cloud);
      changedFiles.push(...deletedKeys.map((key) => `cloud:${key}`), backupTarget);
    }
  }

  if (cloud) {
    try {
      const contentMetadata = await collectCloudContentMetadata(config, services, wikiIndex);
      const contentDiscoverySync = await syncContentDiscovery({
        contentIndexRows: contentMetadata.contentIndexRows,
        contentSearchRows: contentMetadata.contentSearchRows ?? [],
        managedCollections: contentMetadata.managedCollections,
      });
      if (contentDiscoverySync.applied) {
        changedFiles.push('d1:content_index');
        changedFiles.push('d1:content_search');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SupportCodeError('SYNC-CONTENT-INDEX-FAILED', `D1 content lookup/index sync failed: ${message}`);
    }
  }

  return {
    changedFiles,
    backupRootForRun: staleAction === 'backup' && diff.grouped.stale.length ? backupRootForRun : null,
  };
}
