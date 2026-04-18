import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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

export function buildContentSearchSyncPlan({ rows, managedCollections }) {
  return {
    rows: rows
      .slice()
      .sort((left, right) => left.collection.localeCompare(right.collection) || left.id.localeCompare(right.id)),
    managedCollections: [...new Set(managedCollections)].sort((left, right) => left.localeCompare(right)),
  };
}

export function buildContentSearchSql(plan, options = {}) {
  if (plan.managedCollections.length === 0) {
    return '';
  }

  const replaceCollections = options.replaceCollections ?? true;

  const rowsByCollection = new Map();
  for (const row of plan.rows) {
    if (!rowsByCollection.has(row.collection)) {
      rowsByCollection.set(row.collection, []);
    }

    rowsByCollection.get(row.collection).push(row);
  }

  const statements = [];

  for (const collection of plan.managedCollections) {
    if (replaceCollections) {
      statements.push(`DELETE FROM content_search WHERE collection = ${quoteSqlLiteral(collection)};`);
    }

    const collectionRows = rowsByCollection.get(collection) || [];
    for (const row of collectionRows) {
      statements.push(`
INSERT INTO content_search (
  collection,
  id,
  slug,
  title,
  summary,
  type,
  subtype,
  tags_text,
  body_text
)
VALUES (
  ${quoteSqlLiteral(row.collection)},
  ${quoteSqlLiteral(row.id)},
  ${quoteSqlLiteral(row.slug)},
  ${quoteSqlLiteral(row.title)},
  ${quoteSqlLiteral(normalizeNullableString(row.summary))},
  ${quoteSqlLiteral(normalizeNullableString(row.type))},
  ${quoteSqlLiteral(normalizeNullableString(row.subtype))},
  ${quoteSqlLiteral(row.tagsText)},
  ${quoteSqlLiteral(row.bodyText)}
)
ON CONFLICT(collection, id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  summary = excluded.summary,
  type = excluded.type,
  subtype = excluded.subtype,
  tags_text = excluded.tags_text,
  body_text = excluded.body_text;`.trim());
    }
  }

  return `${statements.join('\n')}\n`;
}

export function resolveContentSearchSyncTarget(env = process.env) {
  const modeRaw = normalizeNullableString(env.CONTENT_INDEX_SYNC_MODE)?.toLowerCase();
  const enabled = modeRaw === 'off' ? false : parseEnabledFlag(env.CONTENT_INDEX_SYNC_ENABLED);

  return {
    enabled,
    mode: modeRaw === 'remote' ? 'remote' : 'local',
    envName: normalizeNullableString(env.CONTENT_INDEX_SYNC_ENV),
  };
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

export async function syncContentSearch({ rows, managedCollections, env = process.env }) {
  const target = resolveContentSearchSyncTarget(env);
  const plan = buildContentSearchSyncPlan({ rows, managedCollections });

  if (!target.enabled || plan.managedCollections.length === 0) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const sql = buildContentSearchSql(plan);
  if (!sql) {
    return {
      applied: false,
      target,
      plan,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'woa-content-search-'));
  const sqlPath = path.join(tempDir, 'content-search-sync.sql');

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
