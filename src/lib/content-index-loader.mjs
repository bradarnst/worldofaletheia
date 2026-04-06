import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lookupCache = new Map();

function normalizeNullableString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function resolveWranglerCommand() {
  try {
    return require.resolve('wrangler/bin/wrangler.js');
  } catch {
    return 'wrangler';
  }
}

export function resolveContentLookupTarget(env = process.env) {
  const modeRaw = normalizeNullableString(env.CONTENT_LOADER_D1_MODE)?.toLowerCase();

  return {
    mode: modeRaw === 'remote' ? 'remote' : 'local',
    envName: normalizeNullableString(env.CONTENT_LOADER_D1_ENV),
  };
}

export function parseWranglerJsonResults(rawOutput) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error('Wrangler did not return valid JSON for content lookup.');
  }

  const statements = Array.isArray(parsed) ? parsed : [parsed];
  const firstStatement = statements[0];
  if (!firstStatement || typeof firstStatement !== 'object') {
    throw new Error('Wrangler returned an unexpected D1 JSON payload for content lookup.');
  }

  if (firstStatement.success === false) {
    throw new Error('Wrangler reported a failed D1 content lookup query.');
  }

  return Array.isArray(firstStatement.results) ? firstStatement.results : [];
}

export function parseContentLookupRows(rawRows, collection) {
  if (!Array.isArray(rawRows)) {
    throw new Error(`Unexpected D1 lookup payload for collection ${collection}.`);
  }

  return rawRows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Invalid D1 lookup row for collection ${collection}.`);
    }

    const id = String(row.id ?? '').trim();
    const r2Key = String(row.r2_key ?? '').trim();
    if (!id || !r2Key) {
      throw new Error(`D1 lookup row for collection ${collection} is missing required id/r2_key fields.`);
    }

    return {
      id,
      slug: typeof row.slug === 'string' ? row.slug : undefined,
      r2Key,
      visibility: typeof row.visibility === 'string' ? row.visibility : undefined,
      campaignSlug:
        typeof row.campaign_slug === 'string'
          ? row.campaign_slug
          : row.campaign_slug === null
            ? null
            : undefined,
    };
  });
}

function runCollectionLookupQuery(collection, target) {
  const args = ['d1', 'execute', 'DB'];
  if (target.mode === 'remote') {
    args.push('--remote');
    if (target.envName) {
      args.push('--env', target.envName);
    }
  } else {
    args.push('--local');
  }

  const sql = `
SELECT
  id,
  slug,
  r2_key,
  visibility,
  campaign_slug
FROM content_index
WHERE collection = ${quoteSqlLiteral(collection)}
  AND r2_key != ''
ORDER BY slug ASC, id ASC;
  `.trim();

  args.push('--json', '--command', sql);

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

  return parseWranglerJsonResults(result.stdout || '[]');
}

export async function loadCollectionLookupRows(collection, env = process.env) {
  const target = resolveContentLookupTarget(env);
  const cacheKey = `${target.mode}:${target.envName ?? ''}:${collection}`;
  const cached = lookupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rows = parseContentLookupRows(runCollectionLookupQuery(collection, target), collection);
  lookupCache.set(cacheKey, rows);
  return rows;
}

export function clearContentLookupCache() {
  lookupCache.clear();
}
