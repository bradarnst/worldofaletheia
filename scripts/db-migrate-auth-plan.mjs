#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const orderedMigrations = [
  './migrations/0001_campaign_memberships.sql',
  './migrations/0002_campaign_gm_assignments.sql',
  './migrations/0003_auth_core.sql',
  './migrations/0004_auth_email_hardening.sql',
  './migrations/0005_campaign_gm_assignments_multi.sql',
  './migrations/0006_content_index.sql',
  './migrations/0007_content_index_r2_lookup.sql',
  './migrations/0008_content_index_collection_scoped_identity.sql',
  './migrations/0009_campaign_memberships_role_unification.sql',
  './migrations/0010_drop_campaign_gm_assignments.sql',
  './migrations/0011_content_search_fts.sql',
];

export function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((part) => part.startsWith('--')));
  const modeArg = args.find((part) => part.startsWith('--mode='));
  const envArg = args.find((part) => part.startsWith('--env='));

  const mode = modeArg ? modeArg.split('=')[1] : 'local';
  const envName = envArg ? envArg.split('=')[1] : null;

  if (!['local', 'remote'].includes(mode)) {
    throw new Error(`Invalid --mode value: ${mode}. Expected local or remote.`);
  }

  return {
    mode,
    envName,
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
  };
}

function buildBaseWranglerArgs({ mode, envName }) {
  const args = ['d1', 'execute', 'DB'];
  if (mode === 'local') {
    args.push('--local');
  } else {
    args.push('--remote');
    if (envName) {
      args.push('--env', envName);
    }
  }
  return args;
}

function runWrangler(baseArgs, extraArgs, { allowFailure = false } = {}) {
  const commandArgs = [...baseArgs, ...extraArgs];
  const result = spawnSync('wrangler', commandArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!allowFailure && result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      `wrangler command failed: wrangler ${commandArgs.join(' ')}\n${stderr || stdout || 'No output returned.'}`,
    );
  }

  return result;
}

function parseWranglerPayload(raw, sourceLabel) {
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      rows: null,
      error: `${sourceLabel} is not valid JSON (${reason}).`,
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      rows: null,
      error: `${sourceLabel} did not contain a Wrangler result array.`,
    };
  }

  const firstResult = parsed[0];
  if (!firstResult || typeof firstResult !== 'object' || !Array.isArray(firstResult.results)) {
    return {
      rows: null,
      error: `${sourceLabel} did not contain a results array.`,
    };
  }

  return {
    rows: firstResult.results,
    error: null,
  };
}

function collectJsonArrayCandidates(text) {
  const candidates = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '[') {
      continue;
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (character === '\\') {
          isEscaped = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === '[') {
        depth += 1;
        continue;
      }

      if (character !== ']') {
        continue;
      }

      depth -= 1;
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1));
        break;
      }
    }
  }

  return candidates;
}

export function parseWranglerRows(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return {
      rows: null,
      error: 'Wrangler returned no output.',
    };
  }

  const directParse = parseWranglerPayload(text, 'Wrangler output');
  if (!directParse.error) {
    return directParse;
  }

  const payloadMatches = collectJsonArrayCandidates(text);
  if (!payloadMatches || payloadMatches.length === 0) {
    return {
      rows: null,
      error: 'Wrangler output did not contain a parseable JSON payload.',
    };
  }

  const errors = [];
  for (const payload of payloadMatches.reverse()) {
    const parsedPayload = parseWranglerPayload(payload, 'Embedded Wrangler JSON payload');
    if (!parsedPayload.error) {
      return parsedPayload;
    }

    errors.push(parsedPayload.error);
  }

  return {
    rows: null,
    error: errors[errors.length - 1] || directParse.error,
  };
}

function buildWranglerOutputCandidates({ stdout, stderr }) {
  const candidates = [];
  const rawCandidates = [
    String(stdout || ''),
    String(stderr || ''),
    [stdout, stderr].filter(Boolean).join('\n'),
    [stderr, stdout].filter(Boolean).join('\n'),
  ];

  for (const candidate of rawCandidates) {
    const normalized = String(candidate || '').trim();
    if (!normalized || candidates.includes(normalized)) {
      continue;
    }

    candidates.push(normalized);
  }

  return candidates;
}

export function extractWranglerRowsFromResult(result) {
  const errors = [];

  for (const candidate of buildWranglerOutputCandidates(result)) {
    const parsed = parseWranglerRows(candidate);
    if (!parsed.error) {
      return parsed;
    }

    errors.push(parsed.error);
  }

  return {
    rows: null,
    error: errors[errors.length - 1] || 'Wrangler returned no parseable JSON output.',
  };
}

export function interpretNumericRows(label, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      label,
      value: null,
      error: `${label} query returned no rows.`,
    };
  }

  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
    return {
      label,
      value: null,
      error: `${label} query returned an unreadable first row.`,
    };
  }

  const firstValue = Object.values(firstRow)[0];
  const numericValue = Number(firstValue);
  if (!Number.isFinite(numericValue)) {
    return {
      label,
      value: null,
      error: `${label} query returned a non-numeric first value (${JSON.stringify(firstValue)}).`,
    };
  }

  return {
    label,
    value: numericValue,
    error: null,
  };
}

export function interpretNumericWranglerResult(result, label) {
  if (result.status !== 0) {
    return {
      label,
      value: null,
      error: (result.stderr || result.stdout || '').trim() || 'query failed',
    };
  }

  const parsedRows = extractWranglerRowsFromResult(result);
  if (parsedRows.error) {
    return {
      label,
      value: null,
      error: `${label} query output was unreadable: ${parsedRows.error}`,
    };
  }

  return interpretNumericRows(label, parsedRows.rows);
}

function requireNumericValue(result, context = result.label) {
  if (result.error || result.value === null || !Number.isFinite(result.value)) {
    throw new Error(`Unable to evaluate ${context}: ${result.error || 'numeric result unavailable.'}`);
  }

  return result.value;
}

function queryNumeric(baseArgs, label, sql) {
  const result = runWrangler(baseArgs, ['--json', '--command', sql], { allowFailure: true });
  return interpretNumericWranglerResult(result, label);
}

function queryText(baseArgs, sql) {
  const result = runWrangler(baseArgs, ['--json', '--command', sql], { allowFailure: true });
  const parsedRows = extractWranglerRowsFromResult(result);
  return {
    ok: result.status === 0 && !parsedRows.error,
    output: parsedRows.rows
      ? parsedRows.rows
          .map((row) => Object.values(row).map((value) => String(value)).join(' | '))
          .join('\n')
      : '',
    error:
      result.status !== 0
        ? (result.stderr || result.stdout || '').trim() || 'query failed'
        : parsedRows.error,
  };
}

function tableExists(baseArgs, tableName) {
  return requireNumericValue(
    queryNumeric(
      baseArgs,
      `${tableName}_table_exists`,
      `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${tableName}';`,
    ),
    `${tableName} table existence check`,
  ) === 1;
}

function columnExists(baseArgs, tableName, columnName) {
  return requireNumericValue(
    queryNumeric(
      baseArgs,
      `${tableName}.${columnName}`,
      `SELECT COUNT(*) FROM pragma_table_info('${tableName}') WHERE name='${columnName}';`,
    ),
    `${tableName}.${columnName} column existence check`,
  ) === 1;
}

function contentIndexUsesCollectionScopedPrimaryKey(baseArgs) {
  if (!tableExists(baseArgs, 'content_index')) {
    return false;
  }

  const check = queryNumeric(
    baseArgs,
    'content_index.collection_scoped_pk',
    `SELECT COUNT(*)
     FROM pragma_table_info('content_index')
     WHERE (name = 'collection' AND pk = 1)
        OR (name = 'id' AND pk = 2);`,
  );

  return requireNumericValue(check, 'content_index collection-scoped primary key check') === 2;
}

function createSchemaInspector(baseArgs) {
  return {
    queryNumeric(label, sql) {
      return queryNumeric(baseArgs, label, sql);
    },
    queryText(sql) {
      return queryText(baseArgs, sql);
    },
    tableExists(tableName) {
      return tableExists(baseArgs, tableName);
    },
  };
}

export function buildConflictReportFromInspector(inspector) {
  const conflicts = [];

  const objectTypeConflictCount = inspector.queryNumeric(
    'schema_object_conflicts',
    `SELECT COUNT(*)
     FROM sqlite_master
     WHERE name IN ('campaign_memberships','campaign_gm_assignments','content_index','user','account','session','verification')
       AND type <> 'table';`,
  );
  const objectTypeConflicts = inspector.queryText(
    `SELECT name || ':' || type AS bad_object
     FROM sqlite_master
     WHERE name IN ('campaign_memberships','campaign_gm_assignments','content_index','user','account','session','verification')
       AND type <> 'table'
     ORDER BY name;`,
  );
  if (requireNumericValue(objectTypeConflictCount, 'schema object conflict detection') > 0) {
    conflicts.push({
      type: 'schema_object_conflict',
      message:
        'Found existing non-table objects using required table names. Rename/remove conflicting object(s) before running migrations.',
      details: objectTypeConflicts.output || objectTypeConflicts.error || 'No details available.',
    });
  }

  const requiredUserColumns = ['email', 'emailVerified', 'email_canonical'];
  const userTableExists = inspector.queryNumeric(
    'user_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='user';`,
  );

  if (requireNumericValue(userTableExists, 'user table existence check') === 1) {
    for (const column of requiredUserColumns) {
      const hasColumn = inspector.queryNumeric(
        `user.${column}`,
        `SELECT COUNT(*) FROM pragma_table_info('user') WHERE name='${column}';`,
      );
      if (requireNumericValue(hasColumn, `user.${column} column existence check`) === 0) {
        conflicts.push({
          type: 'schema_shape_conflict',
          message: `Existing user table is missing required column: ${column}`,
          details: `Table: user, missing column: ${column}`,
        });
      }
    }

    const duplicateCanonical = inspector.queryNumeric(
      'duplicate_canonical_email_groups',
      `SELECT COUNT(*)
       FROM (
         SELECT trim(lower(email)) AS canonical_email
         FROM "user"
         WHERE email IS NOT NULL AND trim(email) <> ''
         GROUP BY trim(lower(email))
         HAVING COUNT(*) > 1
       );`,
    );
    if (requireNumericValue(duplicateCanonical, 'canonical email collision detection') > 0) {
      const duplicateDetails = inspector.queryText(
        `SELECT trim(lower(email)) AS canonical_email,
                COUNT(*) AS duplicate_count,
                GROUP_CONCAT(id) AS conflicting_user_ids
         FROM "user"
         WHERE email IS NOT NULL AND trim(email) <> ''
         GROUP BY trim(lower(email))
         HAVING COUNT(*) > 1
         ORDER BY duplicate_count DESC, canonical_email ASC
         LIMIT 20;`,
      );

      conflicts.push({
        type: 'canonical_email_collision',
        message:
          'Canonical-email collisions detected (`trim(lower(email))`). Running without force is blocked to prevent ambiguous identity state changes.',
        details: duplicateDetails.output || duplicateDetails.error || 'No details available.',
      });
    }
  }

  const verificationTableExists = inspector.queryNumeric(
    'verification_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='verification';`,
  );
  if (requireNumericValue(verificationTableExists, 'verification table existence check') === 1) {
    const hasExpiry = inspector.queryNumeric(
      'verification.expiresAt',
      `SELECT COUNT(*) FROM pragma_table_info('verification') WHERE name='expiresAt';`,
    );
    if (requireNumericValue(hasExpiry, 'verification.expiresAt column existence check') === 0) {
      conflicts.push({
        type: 'schema_shape_conflict',
        message: 'Existing verification table is missing required column: expiresAt',
        details: 'Table: verification, missing column: expiresAt',
      });
    }
  }

  if (inspector.tableExists('campaign_memberships')) {
    const invalidRoleCount = inspector.queryNumeric(
      'campaign_memberships_invalid_role_rows',
      `SELECT COUNT(*)
       FROM campaign_memberships
       WHERE role IS NULL OR role NOT IN ('member', 'gm');`,
    );

    if (requireNumericValue(invalidRoleCount, 'campaign_memberships invalid role detection') > 0) {
      const invalidRoleDetails = inspector.queryText(
        `SELECT COALESCE(role, '<null>') AS role,
                COUNT(*) AS row_count
         FROM campaign_memberships
         WHERE role IS NULL OR role NOT IN ('member', 'gm')
         GROUP BY role
         ORDER BY role;`,
      );

      conflicts.push({
        type: 'invalid_membership_roles',
        message:
          'campaign_memberships contains unsupported role values. Repair invalid rows before applying migration 0009.',
        details: invalidRoleDetails.output || invalidRoleDetails.error || 'No details available.',
      });
    }
  }

  return conflicts;
}

export function collectDryRunMetricsFromInspector(inspector) {
  const userTableExists = inspector.queryNumeric(
    'user_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='user';`,
  );
  const membershipTableExists = inspector.queryNumeric(
    'campaign_memberships_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='campaign_memberships';`,
  );
  const metrics = [userTableExists, membershipTableExists];
  const userExists = userTableExists.error ? false : userTableExists.value === 1;
  const membershipTablePresent = membershipTableExists.error ? false : membershipTableExists.value === 1;

  if (membershipTablePresent) {
    metrics.push(
      inspector.queryNumeric('campaign_memberships_total', `SELECT COUNT(*) FROM campaign_memberships;`),
      inspector.queryNumeric(
        'campaign_memberships_member_rows',
        `SELECT COUNT(*) FROM campaign_memberships WHERE role = 'member';`,
      ),
      inspector.queryNumeric(
        'campaign_memberships_gm_rows',
        `SELECT COUNT(*) FROM campaign_memberships WHERE role = 'gm';`,
      ),
      inspector.queryNumeric(
        'campaign_memberships_invalid_role_rows',
        `SELECT COUNT(*)
         FROM campaign_memberships
         WHERE role IS NULL OR role NOT IN ('member', 'gm');`,
      ),
    );
  } else {
    metrics.push(
      {
        label: 'campaign_memberships_total',
        value: 0,
        error: 'campaign_memberships table not present yet (would be created by migration plan)',
      },
      {
        label: 'campaign_memberships_member_rows',
        value: 0,
        error: 'campaign_memberships table not present yet (would be created by migration plan)',
      },
      {
        label: 'campaign_memberships_gm_rows',
        value: 0,
        error: 'campaign_memberships table not present yet (would be created by migration plan)',
      },
      {
        label: 'campaign_memberships_invalid_role_rows',
        value: 0,
        error: 'campaign_memberships table not present yet (would be created by migration plan)',
      },
    );
  }

  if (userExists) {
    metrics.push(
      inspector.queryNumeric(
        'users_with_non_canonical_email',
        `SELECT COUNT(*) FROM "user" WHERE email IS NOT NULL AND email <> trim(lower(email));`,
      ),
      inspector.queryNumeric(
        'users_with_missing_email_canonical',
        `SELECT COUNT(*) FROM "user" WHERE email IS NOT NULL AND (email_canonical IS NULL OR email_canonical <> trim(lower(email)));`,
      ),
      inspector.queryNumeric(
        'canonical_collision_groups',
        `SELECT COUNT(*)
         FROM (
           SELECT trim(lower(email)) AS canonical_email
           FROM "user"
           WHERE email IS NOT NULL AND trim(email) <> ''
           GROUP BY trim(lower(email))
           HAVING COUNT(*) > 1
         );`,
      ),
    );
  } else {
    metrics.push(
      {
        label: 'users_with_non_canonical_email',
        value: 0,
        error: 'user table not present yet (would be created by migration plan)',
      },
      {
        label: 'users_with_missing_email_canonical',
        value: 0,
        error: 'user table not present yet (would be created by migration plan)',
      },
      {
        label: 'canonical_collision_groups',
        value: 0,
        error: 'user table not present yet (would be created by migration plan)',
      },
    );
  }

  return metrics;
}

function buildConflictReport(baseArgs) {
  return buildConflictReportFromInspector(createSchemaInspector(baseArgs));
}

function printPlanSummary(baseArgs) {
  console.log('\n=== Ordered migration plan ===');
  for (const [index, migration] of orderedMigrations.entries()) {
    console.log(`${index + 1}. ${migration}`);
  }

  console.log('\n=== Dry-run: what would change ===');
  console.log('- Ensure campaign membership authority exists and remains constrained to the canonical role model.');
  console.log('- Apply legacy GM-table decommission so final schema relies only on campaign_memberships roles.');
  console.log('- Ensure Better Auth core tables/user columns/indexes exist (idempotent create-if-missing).');
  console.log('- Ensure content discovery index table + supporting indexes exist (idempotent create-if-missing).');
  console.log('- Normalize email values to trim(lower(email)) and backfill email_canonical where needed.');
  console.log('- Enforce strict unique canonical email index (fails immediately if duplicates remain).');

  const metrics = collectDryRunMetricsFromInspector(createSchemaInspector(baseArgs));

  console.log('\n=== Dry-run metrics ===');
  for (const metric of metrics) {
    if (metric.error) {
      console.log(`- ${metric.label}: unavailable (${metric.error})`);
      continue;
    }
    console.log(`- ${metric.label}: ${metric.value}`);
  }
}

function hasConflictType(conflicts, type) {
  return conflicts.some((conflict) => conflict.type === type);
}

function hasNonForceableConflict(conflicts) {
  return hasConflictType(conflicts, 'invalid_membership_roles');
}

function applyForcedCanonicalCollisionOverwrite(baseArgs) {
  const userExists = tableExists(baseArgs, 'user');
  if (!userExists) {
    return;
  }

  console.warn('\nApplying forced canonical-email overwrite strategy for duplicate rows...');

  const emailOverwriteSql = `
WITH normalized AS (
  SELECT id, trim(lower(email)) AS canonical_email
  FROM "user"
  WHERE email IS NOT NULL AND trim(email) <> ''
),
ranked AS (
  SELECT
    id,
    canonical_email,
    ROW_NUMBER() OVER (PARTITION BY canonical_email ORDER BY id ASC) AS rn
  FROM normalized
),
losers AS (
  SELECT id, canonical_email
  FROM ranked
  WHERE rn > 1
)
UPDATE "user"
SET email = 'forced+' || substr("user".id, 1, 8) || '+' || (
      SELECT losers.canonical_email
      FROM losers
      WHERE losers.id = "user".id
    ),
    updatedAt = datetime('now')
WHERE id IN (SELECT id FROM losers);
`;

  runWrangler(baseArgs, ['--command', emailOverwriteSql]);

  const hasCanonicalColumn = queryNumeric(
    baseArgs,
    'user.email_canonical',
    `SELECT COUNT(*) FROM pragma_table_info('user') WHERE name='email_canonical';`,
  );

  if (requireNumericValue(hasCanonicalColumn, 'user.email_canonical column existence check') === 1) {
    runWrangler(
      baseArgs,
      [
        '--command',
        `UPDATE "user"
         SET email_canonical = trim(lower(email))
         WHERE email IS NOT NULL
           AND (email_canonical IS NULL OR email_canonical <> trim(lower(email)));`,
      ],
    );
  }
}

function printConflictBlock(conflicts, { forced }) {
  console.log('\n=== Conflict detection ===');
  for (const [index, conflict] of conflicts.entries()) {
    console.log(`\n[${index + 1}] ${conflict.type}`);
    console.log(`Reason: ${conflict.message}`);
    console.log(`Details:\n${conflict.details}`);
  }

  if (!forced) {
    console.error('\nBlocked: conflict(s) detected. Re-run with --force only after operator review and approval.');
  } else if (hasNonForceableConflict(conflicts)) {
    console.error('\nBlocked: one or more conflicts are not forceable and must be repaired before migration can continue.');
  } else {
    console.warn('\nWarning: --force supplied. Proceeding despite detected conflict(s).');
  }
}

function runMigrationPlan(baseArgs) {
  console.log('\n=== Applying ordered migration plan ===');
  for (const migrationFile of orderedMigrations) {
    if (migrationFile === './migrations/0007_content_index_r2_lookup.sql' && columnExists(baseArgs, 'content_index', 'r2_key')) {
      console.log(`Skipping ${migrationFile} (content_index.r2_key already exists).`);
      continue;
    }

    if (
      migrationFile === './migrations/0008_content_index_collection_scoped_identity.sql' &&
      contentIndexUsesCollectionScopedPrimaryKey(baseArgs)
    ) {
      console.log(`Skipping ${migrationFile} (content_index already uses PRIMARY KEY (collection, id)).`);
      continue;
    }

    console.log(`Applying ${migrationFile}...`);
    runWrangler(baseArgs, ['--file', migrationFile]);
  }
  console.log('✓ Migration plan applied successfully.');
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const baseArgs = buildBaseWranglerArgs(args);

    console.log(`Target mode: ${args.mode}${args.envName ? ` (env=${args.envName})` : ''}`);
    console.log(`Flags: dry-run=${args.dryRun ? 'on' : 'off'}, force=${args.force ? 'on' : 'off'}`);

    printPlanSummary(baseArgs);
    const conflicts = buildConflictReport(baseArgs);

    if (conflicts.length > 0) {
      printConflictBlock(conflicts, { forced: args.force });
      if (hasNonForceableConflict(conflicts) || !args.force) {
        process.exitCode = 1;
        return;
      }

      if (!args.dryRun && hasConflictType(conflicts, 'canonical_email_collision')) {
        applyForcedCanonicalCollisionOverwrite(baseArgs);
      }
    } else {
      console.log('\nNo conflicts detected.');
    }

    if (args.dryRun) {
      console.log('\nDry-run complete. No migration files were executed.');
      return;
    }

    runMigrationPlan(baseArgs);
  } catch (error) {
    console.error('Migration runner failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
