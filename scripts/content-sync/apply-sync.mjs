import fs from 'node:fs/promises';
import path from 'node:path';
import { buildWikiLinkIndex, transformObsidianLinks } from './obsidian-links.mjs';
import { syncContentIndex } from './content-index-writer.mjs';
import { syncCloudManifests } from './manifests.mjs';

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

export async function applySync(diff, config, staleAction, services = {}) {
  const changedFiles = [];
  const backupSession = timestamp();
  const backupRootForRun = path.resolve(config.resolvedBackupRoot, backupSession);
  const wikiIndex = await buildWikiLinkIndex(config.repoRoot);
  const cloud = services.cloud || null;

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
      const sourceExt = path.extname(rec.sourceAbs).toLowerCase();
      const contentType = contentTypeForExtension(sourceExt);
      if (sourceExt === '.md') {
        const sourceText = await fs.readFile(rec.sourceAbs, 'utf8');
        const transformed = transformObsidianLinks(sourceText, {
          destAbs: resolveCloudMirrorDestination(config, rec.mapping, rec.relativePath),
          repoRoot: config.repoRoot,
          wikiIndex,
        });
        await cloud.uploadText(rec.cloudKey, transformed, contentType);
      } else {
        await cloud.uploadFile(rec.mapping.to, rec.relativePath, rec.sourceAbs, contentType);
      }
      changedFiles.push(`cloud:${rec.cloudKey}`);
    } catch (uploadError) {
      console.error(`Cloud upload failed for ${rec.cloudKey}:`, uploadError.message);
      // Continue processing remaining files — D1 index needs all content, not just cloud-reachable content
    }
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

      await cloud.deleteObject(rec.mapping.to, rec.relativePath);
      changedFiles.push(`cloud:${rec.cloudKey}`);
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
      await cloud.deleteObject(rec.mapping.to, rec.relativePath);
      changedFiles.push(`cloud:${rec.cloudKey}`, backupTarget);
    }
  }

  if (cloud) {
    const manifestSync = await syncCloudManifests(config, services, wikiIndex);
    changedFiles.push(...manifestSync.writtenKeys.map((key) => `cloud:${key}`));

    // D1 discovery index is updated alongside cloud manifest sync using the same
    // manifest rows. It runs regardless of whether R2 uploads succeeded.
    let contentIndexApplied = false;
    try {
      const contentIndexSync = await syncContentIndex({
        rows: manifestSync.contentIndexRows,
        managedCollections: manifestSync.managedCollections,
      });
      if (contentIndexSync.applied) {
        changedFiles.push('d1:content_index');
        contentIndexApplied = true;
      }
    } catch (error) {
      console.error('D1 content index sync failed:', error.message);
    }
  }

  return {
    changedFiles,
    backupRootForRun: staleAction === 'backup' && diff.grouped.stale.length ? backupRootForRun : null,
  };
}
