import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePathForDisplay } from './utils.mjs';

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root, includeExtensions) {
  const out = [];
  if (!(await pathExists(root))) {
    return out;
  }

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (includeExtensions.includes(ext)) {
        out.push(absolute);
      }
    }
  }

  await walk(root);
  return out;
}

async function filesAreEqual(sourcePath, destPath) {
  const [src, dst] = await Promise.all([fs.readFile(sourcePath), fs.readFile(destPath)]);
  return src.equals(dst);
}

export async function buildSyncDiff(config) {
  const records = [];

  for (const mapping of config.mappings) {
    const sourceRoot = path.resolve(config.vaultRoot, mapping.from);
    const destRoot = path.resolve(config.repoRoot, mapping.to);

    const sourceFiles = await walkFiles(sourceRoot, config.includeExtensions);
    const destFiles = await walkFiles(destRoot, config.includeExtensions);

    const sourceRel = new Map(
      sourceFiles.map((abs) => [normalizePathForDisplay(path.relative(sourceRoot, abs)), abs]),
    );
    const destRel = new Map(
      destFiles.map((abs) => [normalizePathForDisplay(path.relative(destRoot, abs)), abs]),
    );

    const allRel = new Set([...sourceRel.keys(), ...destRel.keys()]);

    for (const rel of allRel) {
      const sourceAbs = sourceRel.get(rel) || null;
      const destAbs = destRel.get(rel) || null;

      if (sourceAbs && !destAbs) {
        records.push({
          type: 'new',
          relativePath: rel,
          sourceAbs,
          destAbs: path.resolve(destRoot, rel),
          mapping,
        });
        continue;
      }

      if (sourceAbs && destAbs) {
        const equal = await filesAreEqual(sourceAbs, destAbs);
        records.push({
          type: equal ? 'unchanged' : 'updated',
          relativePath: rel,
          sourceAbs,
          destAbs,
          mapping,
        });
        continue;
      }

      if (!sourceAbs && destAbs) {
        records.push({
          type: 'stale',
          relativePath: rel,
          sourceAbs: null,
          destAbs,
          mapping,
        });
      }
    }
  }

  const grouped = {
    new: records.filter((r) => r.type === 'new'),
    updated: records.filter((r) => r.type === 'updated'),
    unchanged: records.filter((r) => r.type === 'unchanged'),
    stale: records.filter((r) => r.type === 'stale'),
  };

  return {
    records,
    grouped,
    counts: {
      new: grouped.new.length,
      updated: grouped.updated.length,
      unchanged: grouped.unchanged.length,
      stale: grouped.stale.length,
    },
  };
}
