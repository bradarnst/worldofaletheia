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

export function buildContentDiscoverySyncSql(plan) {
  const contentSearchSql = buildContentSearchSql(plan.contentSearch).trim();
  const contentIndexSql = buildContentIndexSql(plan.contentIndex).trim();
  const body = [contentSearchSql, contentIndexSql].filter((segment) => segment.length > 0).join('\n');

  if (!body) {
    return '';
  }

  return ['BEGIN IMMEDIATE;', body, 'COMMIT;'].join('\n') + '\n';
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

  const sql = buildContentDiscoverySyncSql(plan);
  if (!sql) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-content-discovery-'));
  const sqlPath = path.join(tempDir, 'content-discovery-sync.sql');

  try {
    await fs.writeFile(sqlPath, sql, 'utf8');
    runWranglerSqlFile(target, sqlPath);

    return {
      applied: true,
      target,
      plan,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
