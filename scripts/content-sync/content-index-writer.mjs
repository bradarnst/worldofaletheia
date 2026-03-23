import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PUBLIC_DISCOVERY_CAMPAIGN_COLLECTIONS = new Set(['campaigns', 'sessions']);

function normalizeNullableString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function quoteSqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseEnabledFlag(value) {
  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

export function shouldIndexForPublicDiscovery(row) {
  if (!PUBLIC_DISCOVERY_CAMPAIGN_COLLECTIONS.has(row.collection)) {
    return true;
  }

  return row.visibility === 'public';
}

export function buildContentIndexSyncPlan({ rows, managedCollections }) {
  const filteredRows = [];
  const skippedRows = [];

  for (const row of rows) {
    if (shouldIndexForPublicDiscovery(row)) {
      filteredRows.push(row);
      continue;
    }

    skippedRows.push(row);
  }

  const skippedByCollection = skippedRows.reduce((counts, row) => {
    counts[row.collection] = (counts[row.collection] || 0) + 1;
    return counts;
  }, {});

  return {
    rows: filteredRows.sort((left, right) => left.id.localeCompare(right.id)),
    managedCollections: [...new Set(managedCollections)].sort((left, right) => left.localeCompare(right)),
    skippedRows,
    skippedByCollection,
  };
}

export function buildContentIndexSql(plan) {
  if (plan.managedCollections.length === 0) {
    return '';
  }

  const statements = [
    'BEGIN TRANSACTION;',
    'CREATE TEMP TABLE IF NOT EXISTS __content_index_sync_ids (id TEXT PRIMARY KEY);',
    'CREATE TEMP TABLE IF NOT EXISTS __content_index_sync_collections (collection TEXT PRIMARY KEY);',
    'DELETE FROM __content_index_sync_ids;',
    'DELETE FROM __content_index_sync_collections;',
  ];

  for (const collection of plan.managedCollections) {
    statements.push(
      `INSERT OR IGNORE INTO __content_index_sync_collections (collection) VALUES (${quoteSqlLiteral(collection)});`,
    );
  }

  for (const row of plan.rows) {
    statements.push(`
INSERT INTO content_index (
  id,
  collection,
  slug,
  title,
  type,
  subtype,
  tags_json,
  visibility,
  campaign_slug,
  summary,
  status,
  author,
  created_at,
  updated_at,
  source_etag,
  source_last_modified,
  indexed_at
)
VALUES (
  ${quoteSqlLiteral(row.id)},
  ${quoteSqlLiteral(row.collection)},
  ${quoteSqlLiteral(row.slug)},
  ${quoteSqlLiteral(row.title)},
  ${quoteSqlLiteral(row.type)},
  ${quoteSqlLiteral(row.subtype)},
  ${quoteSqlLiteral(row.tagsJson)},
  ${quoteSqlLiteral(row.visibility)},
  ${quoteSqlLiteral(row.campaignSlug)},
  ${quoteSqlLiteral(row.summary)},
  ${quoteSqlLiteral(row.status)},
  ${quoteSqlLiteral(row.author)},
  ${quoteSqlLiteral(row.createdAt)},
  ${quoteSqlLiteral(row.updatedAt)},
  ${quoteSqlLiteral(row.sourceEtag)},
  ${quoteSqlLiteral(row.sourceLastModified)},
  ${quoteSqlLiteral(row.indexedAt)}
)
ON CONFLICT(id) DO UPDATE SET
  collection = excluded.collection,
  slug = excluded.slug,
  title = excluded.title,
  type = excluded.type,
  subtype = excluded.subtype,
  tags_json = excluded.tags_json,
  visibility = excluded.visibility,
  campaign_slug = excluded.campaign_slug,
  summary = excluded.summary,
  status = excluded.status,
  author = excluded.author,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  source_etag = excluded.source_etag,
  source_last_modified = excluded.source_last_modified,
  indexed_at = excluded.indexed_at;`.trim());
    statements.push(
      `INSERT OR IGNORE INTO __content_index_sync_ids (id) VALUES (${quoteSqlLiteral(row.id)});`,
    );
  }

  statements.push(`
DELETE FROM content_index
WHERE collection IN (SELECT collection FROM __content_index_sync_collections)
  AND id NOT IN (SELECT id FROM __content_index_sync_ids);`.trim());
  statements.push('COMMIT;');

  return `${statements.join('\n')}\n`;
}

export function resolveContentIndexSyncTarget(env = process.env) {
  const modeRaw = normalizeNullableString(env.CONTENT_INDEX_SYNC_MODE)?.toLowerCase();
  const enabled = modeRaw === 'off' ? false : parseEnabledFlag(env.CONTENT_INDEX_SYNC_ENABLED);

  return {
    enabled,
    mode: modeRaw === 'remote' ? 'remote' : 'local',
    envName: normalizeNullableString(env.CONTENT_INDEX_SYNC_ENV),
  };
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

  const result = spawnSync('wrangler', args, {
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

export async function syncContentIndex({ rows, managedCollections, env = process.env }) {
  const target = resolveContentIndexSyncTarget(env);
  const plan = buildContentIndexSyncPlan({ rows, managedCollections });

  if (!target.enabled || plan.managedCollections.length === 0) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const sql = buildContentIndexSql(plan);
  if (!sql) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-content-index-'));
  const sqlPath = path.join(tempDir, 'content-index-sync.sql');

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
