import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWranglerCommand } from '../../src/lib/wrangler-command.mjs';
import {
  buildContentIndexSql,
  buildContentIndexSyncPlan,
  resolveContentIndexSyncTarget,
} from './content-index-writer.mjs';
import { buildContentSearchSql, buildContentSearchSyncPlan } from './content-search-writer.mjs';
import {
  buildAttributionDeleteSql,
  buildAttributionInsertSql,
  buildContributorAttributionSyncPlan,
  buildContributorRegistrySql,
} from './contributor-attribution-writer.mjs';

export function buildContentDiscoverySyncPlan({
  contentIndexRows,
  contentSearchRows,
  contributorRows = [],
  attributionRows = [],
  managedCollections,
}) {
  return {
    contentIndex: buildContentIndexSyncPlan({
      rows: contentIndexRows,
      managedCollections,
    }),
    contentSearch: buildContentSearchSyncPlan({
      rows: contentSearchRows,
      managedCollections,
    }),
    contributorAttribution: buildContributorAttributionSyncPlan({
      contributorRows,
      attributionRows,
      managedCollections,
      requireContributorRegistry: true,
    }),
  };
}

export function buildContentDiscoverySyncSql(plan, options = {}) {
  const contentSearchSql = buildContentSearchSql(plan.contentSearch).trim();
  const contentIndexSql = buildContentIndexSql(plan.contentIndex).trim();
  const contributorRegistrySql = buildContributorRegistrySql(plan.contributorAttribution).trim();
  const attributionDeleteSql = plan.contributorAttribution.managedCollections
    .map((collection) => buildAttributionDeleteSql(collection))
    .join('\n')
    .trim();
  const attributionInsertSql = buildAttributionInsertSql(plan.contributorAttribution).trim();
  const body = [contributorRegistrySql, contentSearchSql, attributionDeleteSql, contentIndexSql, attributionInsertSql]
    .filter((segment) => segment.length > 0)
    .join('\n');
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
  attributionRows,
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

  const attributionPlan = buildContributorAttributionSyncPlan({
    attributionRows,
    managedCollections: [collection],
  });
  const attributionDeleteSql = replaceCollection ? buildAttributionDeleteSql(collection) : '';
  const attributionInsertSql = buildAttributionInsertSql(attributionPlan, { collection }).trim();

  const body = [contentSearchSql, attributionDeleteSql, contentIndexSql, attributionInsertSql]
    .filter((segment) => segment.length > 0)
    .join('\n');
  if (!body) {
    return '';
  }

  if (!transactional) {
    return `${body}\n`;
  }

  return ['BEGIN IMMEDIATE;', body, 'COMMIT;'].join('\n') + '\n';
}

export function buildContentDiscoverySyncSqlChunks(plan, options = {}) {
  const transactional = options.transactional ?? false;
  const chunks = [];
  const contributorRegistrySql = buildContributorRegistrySql(plan.contributorAttribution).trim();

  if (contributorRegistrySql) {
    chunks.push(transactional ? ['BEGIN IMMEDIATE;', contributorRegistrySql, 'COMMIT;'].join('\n') + '\n' : `${contributorRegistrySql}\n`);
  }

  for (const collection of plan.contentIndex.managedCollections) {
    const collectionIndexRows = plan.contentIndex.rows.filter((row) => row.collection === collection);
    const collectionSearchRows = plan.contentSearch.rows.filter((row) => row.collection === collection);
    const collectionAttributionRows = plan.contributorAttribution.attributionRows.filter(
      (row) => row.targetCollection === collection,
    );
    const sql = buildCollectionChunkSql({
      collection,
      contentIndexRows: collectionIndexRows,
      contentSearchRows: collectionSearchRows,
      attributionRows: collectionAttributionRows,
      replaceCollection: true,
      transactional,
    });

    if (sql) {
      chunks.push(sql);
    }
  }

  return chunks;
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

export async function syncContentDiscovery({
  contentIndexRows,
  contentSearchRows,
  contributorRows = [],
  attributionRows = [],
  managedCollections,
  env = process.env,
}) {
  const target = resolveContentIndexSyncTarget(env);
  const plan = buildContentDiscoverySyncPlan({
    contentIndexRows,
    contentSearchRows,
    contributorRows,
    attributionRows,
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
  // execute one file per collection so content_search and content_index stay grouped,
  // even though the full site sync is not yet atomic.
  // NOTE: current Wrangler D1 file execution rejects SQL BEGIN/COMMIT for both local
  // and remote execution paths, so emitted SQL must stay non-transactional.
  const sqlChunks = buildContentDiscoverySyncSqlChunks(plan, { transactional: false });
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
