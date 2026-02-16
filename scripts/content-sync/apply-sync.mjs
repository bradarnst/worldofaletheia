import fs from 'node:fs/promises';
import path from 'node:path';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function applySync(diff, config, staleAction) {
  const changedFiles = [];
  const backupSession = timestamp();
  const backupRootForRun = path.resolve(config.resolvedBackupRoot, backupSession);

  for (const rec of [...diff.grouped.new, ...diff.grouped.updated]) {
    await ensureParent(rec.destAbs);
    await fs.copyFile(rec.sourceAbs, rec.destAbs);
    changedFiles.push(rec.destAbs);
  }

  if (staleAction === 'remove') {
    for (const rec of diff.grouped.stale) {
      await fs.rm(rec.destAbs, { force: true });
      changedFiles.push(rec.destAbs);
    }
  }

  if (staleAction === 'backup') {
    for (const rec of diff.grouped.stale) {
      const backupTarget = path.resolve(
        backupRootForRun,
        rec.mapping.to,
        rec.relativePath,
      );
      await ensureParent(backupTarget);
      await fs.copyFile(rec.destAbs, backupTarget);
      await fs.rm(rec.destAbs, { force: true });
      changedFiles.push(rec.destAbs, backupTarget);
    }
  }

  return {
    changedFiles,
    backupRootForRun: staleAction === 'backup' && diff.grouped.stale.length ? backupRootForRun : null,
  };
}

