import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pbkdf2 as pbkdf2Callback, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';

export const HASH_PREFIX = 'woa-pbkdf2-sha256-v1';
export const DEFAULT_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 1_000_000;
export const SALT_BYTES = 32;
export const KEY_BYTES = 32;
export const MIN_PASSWORD_LENGTH = 8;

const pbkdf2 = promisify(pbkdf2Callback);
const VALID_ENVS = new Set(['local', 'staging', 'prod']);

export function parseArgs(argv) {
  const options = {
    env: undefined,
    email: undefined,
    userId: undefined,
    dryRun: false,
    revokeSessions: false,
    createCredential: false,
    yes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === '--env') {
      options.env = readValue();
    } else if (arg === '--email') {
      options.email = readValue();
    } else if (arg === '--user-id') {
      options.userId = readValue();
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--revoke-sessions') {
      options.revokeSessions = true;
    } else if (arg === '--create-credential') {
      options.createCredential = true;
    } else if (arg === '--yes') {
      options.yes = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function validateOptions(options, env = process.env) {
  if (!options.env || !VALID_ENVS.has(options.env)) {
    throw new Error('--env must be one of: local, staging, prod');
  }

  if ((options.email && options.userId) || (!options.email && !options.userId)) {
    throw new Error('Provide exactly one target: --email <email> or --user-id <id>');
  }

  if (typeof env.PASSWORD_HASH_PEPPER !== 'string' || env.PASSWORD_HASH_PEPPER.length === 0) {
    throw new Error('Missing required environment variable: PASSWORD_HASH_PEPPER');
  }
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function getWranglerD1Args(targetEnv, sqlFile) {
  const args = ['d1', 'execute', 'DB'];
  if (targetEnv === 'local') {
    args.push('--local');
  } else if (targetEnv === 'staging') {
    args.push('--remote', '--env', 'staging');
  } else if (targetEnv === 'prod') {
    args.push('--remote');
  } else {
    throw new Error(`Unsupported environment: ${targetEnv}`);
  }

  if (sqlFile) {
    args.push('--file', sqlFile);
  }

  return args;
}

function getWranglerD1CommandArgs(targetEnv, command) {
  return [...getWranglerD1Args(targetEnv), '--json', '--command', command];
}

export function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseWranglerResults(stdout) {
  const parsed = JSON.parse(stdout);
  const results = Array.isArray(parsed) ? parsed : [parsed];
  return results.flatMap((entry) => {
    if (Array.isArray(entry?.results)) return entry.results;
    if (Array.isArray(entry?.result?.results)) return entry.result.results;
    if (Array.isArray(entry?.result)) return entry.result;
    return [];
  });
}

function executeD1Query(targetEnv, command) {
  const stdout = execFileSync('wrangler', getWranglerD1CommandArgs(targetEnv, command), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return parseWranglerResults(stdout);
}

export async function hashPasswordForOperator(password, env = process.env) {
  const pepper = env.PASSWORD_HASH_PEPPER;
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('Missing required environment variable: PASSWORD_HASH_PEPPER');
  }

  const configuredIterations = env.PASSWORD_HASH_ITERATIONS;
  const iterations = configuredIterations === undefined ? DEFAULT_ITERATIONS : Number(configuredIterations);
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) {
    throw new Error('PASSWORD_HASH_ITERATIONS must be a positive integer within the supported range');
  }

  const salt = randomBytes(SALT_BYTES);
  const passwordMaterial = Buffer.from(`${password.normalize('NFKC')}\0${pepper}`, 'utf8');
  const derivedKey = await pbkdf2(passwordMaterial, salt, iterations, KEY_BYTES, 'sha256');

  return `${HASH_PREFIX}:${iterations}:${salt.toString('base64url')}:${derivedKey.toString('base64url')}`;
}

export function buildLookupSql(options) {
  if (options.email) {
    const canonicalEmail = normalizeEmail(options.email);
    return `SELECT id, email, email_canonical FROM "user" WHERE COALESCE(email_canonical, lower(trim(email))) = ${sqlString(canonicalEmail)};`;
  }

  return `SELECT id, email, email_canonical FROM "user" WHERE id = ${sqlString(options.userId)};`;
}

export function buildCredentialLookupSql(userId) {
  return `SELECT id, accountId, providerId, userId FROM account WHERE providerId = 'credential' AND userId = ${sqlString(userId)} ORDER BY updatedAt DESC;`;
}

export function buildCredentialWriteSql(input) {
  const now = new Date().toISOString();
  const statements = ['BEGIN TRANSACTION;'];

  if (input.existingCredentialId) {
    statements.push(
      `UPDATE account SET password = ${sqlString(input.passwordHash)}, updatedAt = ${sqlString(now)} WHERE id = ${sqlString(input.existingCredentialId)} AND providerId = 'credential' AND userId = ${sqlString(input.userId)};`,
    );
  } else {
    const accountId = input.newAccountRowId ?? `credential-${randomUUID()}`;
    statements.push(
      `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (${sqlString(accountId)}, ${sqlString(input.userId)}, 'credential', ${sqlString(input.userId)}, ${sqlString(input.passwordHash)}, ${sqlString(now)}, ${sqlString(now)});`,
    );
  }

  if (input.revokeSessions) {
    statements.push(`DELETE FROM session WHERE userId = ${sqlString(input.userId)};`);
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

export function getSanitizedPlan(input) {
  return {
    environment: input.environment,
    target: input.target,
    userId: input.userId,
    email: input.email,
    credentialAction: input.credentialAction,
    revokeSessions: input.revokeSessions,
    dryRun: input.dryRun,
    hashPrefix: HASH_PREFIX,
  };
}

export function renderSanitizedPlan(plan) {
  return [
    'Operator password reset plan:',
    `- environment: ${plan.environment}`,
    `- target: ${plan.target}`,
    `- user id: ${plan.userId}`,
    `- email: ${plan.email ?? '(not available)'}`,
    `- credential action: ${plan.credentialAction}`,
    `- revoke sessions: ${plan.revokeSessions ? 'yes' : 'no'}`,
    `- dry run: ${plan.dryRun ? 'yes' : 'no'}`,
    `- hash prefix: ${plan.hashPrefix}`,
  ].join('\n');
}

async function readPasswordPair() {
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output: mutedOutput, terminal: true });
  try {
    process.stderr.write('New password: ');
    const password = await rl.question('New password: ');
    process.stderr.write('\nConfirm new password: ');
    const confirmation = await rl.question('Confirm new password: ');
    process.stderr.write('\n');
    return { password, confirmation };
  } finally {
    rl.close();
  }
}

async function confirmOperation(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${prompt} Type YES to continue: `);
    return answer === 'YES';
  } finally {
    rl.close();
  }
}

function assertSingleRow(rows, description) {
  if (rows.length === 0) {
    throw new Error(`No ${description} found`);
  }
  if (rows.length > 1) {
    throw new Error(`Multiple ${description} rows found; aborting`);
  }
  return rows[0];
}

function applySql(targetEnv, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), 'woa-reset-password-'));
  const sqlFile = join(tempDir, 'reset.sql');
  try {
    writeFileSync(sqlFile, sql, { encoding: 'utf8', mode: 0o600 });
    execFileSync('wrangler', getWranglerD1Args(targetEnv, sqlFile), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function runOperatorReset(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  validateOptions(options, env);

  const { password, confirmation } = await readPasswordPair();
  if (password !== confirmation) {
    throw new Error('Password confirmation does not match');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const users = executeD1Query(options.env, buildLookupSql(options));
  const user = assertSingleRow(users, 'matching user');
  const userId = String(user.id);
  const credentials = executeD1Query(options.env, buildCredentialLookupSql(userId));
  if (credentials.length > 1) {
    throw new Error('Multiple credential account rows found for user; aborting');
  }

  const credential = credentials[0];
  if (!credential && !options.createCredential) {
    throw new Error('No credential account row exists. Re-run with --create-credential to explicitly create one.');
  }

  if (!options.dryRun && options.env === 'prod' && !options.yes) {
    const confirmed = await confirmOperation('Production password reset requested.');
    if (!confirmed) {
      throw new Error('Production reset not confirmed');
    }
  }

  if (!options.dryRun && !credential && !options.yes) {
    const confirmed = await confirmOperation('Credential account creation requested.');
    if (!confirmed) {
      throw new Error('Credential account creation not confirmed');
    }
  }

  const passwordHash = await hashPasswordForOperator(password, env);
  const credentialAction = credential ? 'update' : 'create';
  const plan = getSanitizedPlan({
    environment: options.env,
    target: options.email ? 'email' : 'user-id',
    userId,
    email: typeof user.email === 'string' ? user.email : undefined,
    credentialAction,
    revokeSessions: options.revokeSessions,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log(renderSanitizedPlan(plan));
    return plan;
  }

  const sql = buildCredentialWriteSql({
    userId,
    existingCredentialId: credential ? String(credential.id) : undefined,
    passwordHash,
    revokeSessions: options.revokeSessions,
  });
  applySql(options.env, sql);
  console.log(renderSanitizedPlan(plan));
  return plan;
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  runOperatorReset().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Operator password reset failed');
    process.exitCode = 1;
  });
}
