#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const orderedMigrations = [
  './migrations/0001_campaign_memberships.sql',
  './migrations/0002_campaign_gm_assignments.sql',
  './migrations/0003_auth_core.sql',
  './migrations/0004_auth_email_hardening.sql',
  './migrations/0005_campaign_gm_assignments_multi.sql',
  './migrations/0006_content_index.sql',
];

function parseArgs(argv) {
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

function extractNumber(raw, fallback = 0) {
  const match = String(raw).match(/-?\d+/);
  if (!match) {
    return fallback;
  }
  return Number(match[0]);
}

function extractWranglerRows(raw) {
  const text = String(raw || '').trim();
  const payloadMatch = text.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!payloadMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadMatch[1]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const firstResult = parsed[0];
    if (!firstResult || typeof firstResult !== 'object' || !Array.isArray(firstResult.results)) {
      return null;
    }

    return firstResult.results;
  } catch {
    return null;
  }
}

function queryNumeric(baseArgs, label, sql) {
  const result = runWrangler(baseArgs, ['--command', sql], { allowFailure: true });
  if (result.status !== 0) {
    return {
      label,
      value: null,
      error: (result.stderr || result.stdout || '').trim() || 'query failed',
    };
  }

  const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;
  const rows = extractWranglerRows(combinedOutput);
  if (rows && rows.length > 0) {
    const firstValue = Object.values(rows[0])[0];
    const numericValue = Number(firstValue);
    return {
      label,
      value: Number.isNaN(numericValue) ? 0 : numericValue,
      error: null,
    };
  }

  return {
    label,
    value: extractNumber(combinedOutput, 0),
    error: null,
  };
}

function queryText(baseArgs, sql) {
  const result = runWrangler(baseArgs, ['--command', sql], { allowFailure: true });
  const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;
  const rows = extractWranglerRows(combinedOutput);
  return {
    ok: result.status === 0,
    output: rows
      ? rows
          .map((row) => Object.values(row).map((value) => String(value)).join(' | '))
          .join('\n')
      : combinedOutput.trim(),
  };
}

function tableExists(baseArgs, tableName) {
  const check = queryNumeric(
    baseArgs,
    `${tableName}_table_exists`,
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${tableName}';`,
  );
  return check.value === 1;
}

function buildConflictReport(baseArgs) {
  const conflicts = [];

  const objectTypeConflictCount = queryNumeric(
    baseArgs,
    'schema_object_conflicts',
    `SELECT COUNT(*)
     FROM sqlite_master
     WHERE name IN ('campaign_memberships','campaign_gm_assignments','content_index','user','account','session','verification')
       AND type <> 'table';`,
  );
  const objectTypeConflicts = queryText(
    baseArgs,
    `SELECT name || ':' || type AS bad_object
     FROM sqlite_master
     WHERE name IN ('campaign_memberships','campaign_gm_assignments','content_index','user','account','session','verification')
       AND type <> 'table'
     ORDER BY name;`,
  );
  if ((objectTypeConflictCount.value ?? 0) > 0) {
    conflicts.push({
      type: 'schema_object_conflict',
      message:
        'Found existing non-table objects using required table names. Rename/remove conflicting object(s) before running migrations.',
      details: objectTypeConflicts.output,
    });
  }

  const requiredUserColumns = ['email', 'emailVerified', 'email_canonical'];
  const userTableExists = queryNumeric(
    baseArgs,
    'user_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='user';`,
  );

  if (userTableExists.value === 1) {
    for (const column of requiredUserColumns) {
      const hasColumn = queryNumeric(
        baseArgs,
        `user.${column}`,
        `SELECT COUNT(*) FROM pragma_table_info('user') WHERE name='${column}';`,
      );
      if (hasColumn.value === 0) {
        conflicts.push({
          type: 'schema_shape_conflict',
          message: `Existing user table is missing required column: ${column}`,
          details: `Table: user, missing column: ${column}`,
        });
      }
    }

    const duplicateCanonical = queryNumeric(
      baseArgs,
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
    if ((duplicateCanonical.value ?? 0) > 0) {
      const duplicateDetails = queryText(
        baseArgs,
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
        details: duplicateDetails.output || 'No details available.',
      });
    }
  }

  const verificationTableExists = queryNumeric(
    baseArgs,
    'verification_table_exists',
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='verification';`,
  );
  if (verificationTableExists.value === 1) {
    const hasExpiry = queryNumeric(
      baseArgs,
      'verification.expiresAt',
      `SELECT COUNT(*) FROM pragma_table_info('verification') WHERE name='expiresAt';`,
    );
    if (hasExpiry.value === 0) {
      conflicts.push({
        type: 'schema_shape_conflict',
        message: 'Existing verification table is missing required column: expiresAt',
        details: 'Table: verification, missing column: expiresAt',
      });
    }
  }

  return conflicts;
}

function printPlanSummary(baseArgs) {
  console.log('\n=== Ordered migration plan ===');
  for (const [index, migration] of orderedMigrations.entries()) {
    console.log(`${index + 1}. ${migration}`);
  }

  console.log('\n=== Dry-run: what would change ===');
  console.log('- Ensure campaign membership + GM assignment tables/indexes exist (idempotent create-if-missing).');
  console.log('- Ensure Better Auth core tables/user columns/indexes exist (idempotent create-if-missing).');
  console.log('- Ensure content discovery index table + supporting indexes exist (idempotent create-if-missing).');
  console.log('- Normalize email values to trim(lower(email)) and backfill email_canonical where needed.');
  console.log('- Enforce strict unique canonical email index (fails immediately if duplicates remain).');

  const userExists = tableExists(baseArgs, 'user');
  const metrics = [
    {
      label: 'user_table_exists',
      value: userExists ? 1 : 0,
      error: null,
    },
  ];

  if (userExists) {
    metrics.push(
      queryNumeric(
        baseArgs,
        'users_with_non_canonical_email',
        `SELECT COUNT(*) FROM "user" WHERE email IS NOT NULL AND email <> trim(lower(email));`,
      ),
      queryNumeric(
        baseArgs,
        'users_with_missing_email_canonical',
        `SELECT COUNT(*) FROM "user" WHERE email IS NOT NULL AND (email_canonical IS NULL OR email_canonical <> trim(lower(email)));`,
      ),
      queryNumeric(
        baseArgs,
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

  if (hasCanonicalColumn.value === 1) {
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
  } else {
    console.warn('\nWarning: --force supplied. Proceeding despite detected conflict(s).');
  }
}

function runMigrationPlan(baseArgs) {
  console.log('\n=== Applying ordered migration plan ===');
  for (const migrationFile of orderedMigrations) {
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
      if (!args.force) {
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

main();
