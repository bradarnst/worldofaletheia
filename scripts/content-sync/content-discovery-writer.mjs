import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  buildContentIndexSql,
  buildContentIndexSyncPlan,
  resolveContentIndexSyncTarget,
} from './content-index-writer.mjs';
import { buildContentSearchSql, buildContentSearchSyncPlan } from './content-search-writer.mjs';

const require = createRequire(import.meta.url);

export function buildContentDiscoverySyncPlan({ contentIndexRows, contentSearchRows, managedCollections }) {
  return {
    contentIndex: buildContentIndexSyncPlan({
      rows: contentIndexRows,
      managedCollections,
    }),
    contentSearch: buildContentSearchSyncPlan({
      rows: contentSearchRows,
      managedCollections,
    }),
  };
}

export function buildContentDiscoverySyncSql(plan, options = {}) {
  const contentSearchSql = buildContentSearchSql(plan.contentSearch).trim();
  const contentIndexSql = buildContentIndexSql(plan.contentIndex).trim();
  const body = [contentSearchSql, contentIndexSql].filter((segment) => segment.length > 0).join('\n');
  const transactional = options.transactional ?? false;

  if (!body) {
    return '';
  }

  if (!transactional) {
    return `${body}\n`;
  }

  return ['BEGIN IMMEDIATE;', body, 'COMMIT;'].join('\n') + '\n';
}

function buildCollectionChunkSql({
  collection,
  contentIndexRows,
  contentSearchRows,
  replaceCollection,
  transactional,
}) {
  const contentSearchSql = buildContentSearchSql(
    buildContentSearchSyncPlan({
      rows: contentSearchRows,
      managedCollections: [collection],
    }),
    { replaceCollections: replaceCollection },
  ).trim();

  const contentIndexSql = buildContentIndexSql(
    buildContentIndexSyncPlan({
      rows: contentIndexRows,
      managedCollections: [collection],
    }),
    { replaceCollections: replaceCollection },
  ).trim();

  const body = [contentSearchSql, contentIndexSql].filter((segment) => segment.length > 0).join('\n');
  if (!body) {
    return '';
  }

  if (!transactional) {
    return `${body}\n`;
  }

  return ['BEGIN IMMEDIATE;', body, 'COMMIT;'].join('\n') + '\n';
}

export function buildContentDiscoverySyncSqlChunks(plan, options = {}) {
  const transactional = options.transactional ?? true;
  const chunks = [];

  for (const collection of plan.contentIndex.managedCollections) {
    const collectionIndexRows = plan.contentIndex.rows.filter((row) => row.collection === collection);
    const collectionSearchRows = plan.contentSearch.rows.filter((row) => row.collection === collection);
    const sql = buildCollectionChunkSql({
      collection,
      contentIndexRows: collectionIndexRows,
      contentSearchRows: collectionSearchRows,
      replaceCollection: true,
      transactional,
    });

    if (sql) {
      chunks.push(sql);
    }
  }

  return chunks;
}

function resolveWranglerCommand() {
  try {
    return require.resolve('wrangler/bin/wrangler.js');
  } catch {
    return 'wrangler';
  }
}

function runWranglerSqlFile(target, filePath) {
  const args = ['d1', 'execute', 'DB'];
  if (target.mode === 'remote') {
    args.push('--remote');
    if (target.envName) {
      args.push('--env', target.envName);
    }
  } else {
    args.push('--local');
  }

  args.push('--file', filePath);

  const wranglerBin = resolveWranglerCommand();
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      `wrangler command failed: wrangler ${args.join(' ')}\n${stderr || stdout || 'No output returned.'}`,
    );
  }
}

export async function syncContentDiscovery({ contentIndexRows, contentSearchRows, managedCollections, env = process.env }) {
  const target = resolveContentIndexSyncTarget(env);
  const plan = buildContentDiscoverySyncPlan({
    contentIndexRows,
    contentSearchRows,
    managedCollections,
  });

  if (!target.enabled || plan.contentIndex.managedCollections.length === 0) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  // Temporary Wrangler-safe compromise until the private CI/Worker D1 path lands:
  // execute one transaction per collection so content_search and content_index stay
  // aligned within that collection, even though the full site sync is not yet atomic.
  const sqlChunks = buildContentDiscoverySyncSqlChunks(plan, { transactional: true });
  if (sqlChunks.length === 0) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-content-discovery-'));

  try {
    for (const [index, sql] of sqlChunks.entries()) {
      const sqlPath = path.join(tempDir, `content-discovery-sync-${String(index + 1).padStart(3, '0')}.sql`);
      await fs.writeFile(sqlPath, sql, 'utf8');
      runWranglerSqlFile(target, sqlPath);
    }

    return {
      applied: true,
      target,
      plan,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
