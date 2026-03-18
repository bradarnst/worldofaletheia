import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, normalizePathForDisplay, support } from './utils.mjs';

const CONFIG_PATH = path.resolve('config/content-sync.config.json');
const EXAMPLE_CONFIG_PATH = path.resolve('config/content-sync.config.example.json');

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

function isSubPath(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function normalizeMapping(mapping, index) {
  if (!mapping || typeof mapping !== 'object') {
    throw new Error(`Mapping #${index + 1} must be an object.`);
  }

  const from = String(mapping.from || '').trim();
  const to = String(mapping.to || '').trim();
  const target = mapping.target === 'cloud' ? 'cloud' : 'repo';

  if (!from || !to) {
    throw new Error(`Mapping #${index + 1} requires both "from" and "to".`);
  }

  if (target === 'repo') {
    if (path.isAbsolute(to) || to.includes('..')) {
      throw new Error(`Mapping #${index + 1} has invalid destination path: ${to}`);
    }

    const normalizedTo = to.split('\\').join('/');
    const allowedPrefixes = ['src/content/', 'src/assets/'];
    if (!allowedPrefixes.some((prefix) => normalizedTo.startsWith(prefix))) {
      throw new Error(`Mapping #${index + 1} destination must stay under src/content/ or src/assets/: ${to}`);
    }

    return { from, to: normalizedTo, target };
  }

  const normalizedCloudPrefix = trimSlashes(to.split('\\').join('/'));
  if (!normalizedCloudPrefix) {
    throw new Error(`Mapping #${index + 1} cloud prefix must not be empty.`);
  }

  return { from, to: normalizedCloudPrefix, target };
}

function normalizeCampaignCloudConfig(rawConfig, { requireCredentials = true } = {}) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('campaignCloud configuration is required when cloud mappings exist.');
  }

  const bucket = String(rawConfig.bucket || '').trim();
  const accountId = String(rawConfig.accountId || '').trim();
  const region = String(rawConfig.region || 'auto').trim();
  const endpoint = String(rawConfig.endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).trim();
  const accessKeyIdEnv = String(rawConfig.accessKeyIdEnv || 'R2_ACCESS_KEY_ID').trim();
  const secretAccessKeyEnv = String(rawConfig.secretAccessKeyEnv || 'R2_SECRET_ACCESS_KEY').trim();

  if (!bucket) {
    throw new Error('campaignCloud.bucket is required.');
  }
  if (!accountId) {
    throw new Error('campaignCloud.accountId is required.');
  }
  if (!endpoint) {
    throw new Error('campaignCloud.endpoint is required.');
  }

  let credentials = null;
  if (requireCredentials) {
    const accessKeyId = process.env[accessKeyIdEnv];
    const secretAccessKey = process.env[secretAccessKeyEnv];

    if (!accessKeyId) {
      throw new Error(`Environment variable ${accessKeyIdEnv} is required for campaignCloud access.`);
    }
    if (!secretAccessKey) {
      throw new Error(`Environment variable ${secretAccessKeyEnv} is required for campaignCloud access.`);
    }

    credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  return {
    bucket,
    accountId,
    region,
    endpoint,
    accessKeyIdEnv,
    secretAccessKeyEnv,
    credentials,
  };
}

export async function loadConfig(options = {}) {
  const requireCloudCredentials = options.requireCloudCredentials !== false;
  let raw;

  try {
    raw = await fs.readFile(CONFIG_PATH, 'utf8');
  } catch {
    fail('Configuration file is missing.');
    console.log(`Action: copy ${normalizePathForDisplay(EXAMPLE_CONFIG_PATH)} to config/content-sync.config.json and edit vaultRoot.`);
    support('CONFIG-MISSING');
    throw new Error('Missing configuration file.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('Configuration file has invalid JSON.');
    console.log('Action: fix JSON syntax in config/content-sync.config.json and run again.');
    support('CONFIG-JSON-INVALID');
    throw new Error('Invalid JSON config.');
  }

  const vaultRoot = String(parsed.vaultRoot || '').trim();
  if (!vaultRoot) {
    throw new Error('Config requires vaultRoot.');
  }

  const mappings = Array.isArray(parsed.mappings)
    ? parsed.mappings.map((m, i) => normalizeMapping(m, i))
    : [];

  if (!mappings.length) {
    throw new Error('Config requires at least one mapping.');
  }

  const hasCloudMappings = mappings.some((m) => m.target === 'cloud');
  const campaignCloud = hasCloudMappings
    ? normalizeCampaignCloudConfig(parsed.campaignCloud, { requireCredentials: requireCloudCredentials })
    : null;

  const includeExtensions = Array.isArray(parsed.includeExtensions) && parsed.includeExtensions.length
    ? parsed.includeExtensions.map((ext) => String(ext).toLowerCase())
    : ['.md', '.png', '.jpg', '.jpeg', '.webp', '.pdf'];

  const backupRoot = String(parsed.backupRoot || '.content-sync-backups');
  const staleFilePolicy = String(parsed.staleFilePolicy || 'prompt');
  const defaultCommitMessage = String(parsed.defaultCommitMessage || 'chore(content): sync Obsidian content');
  const requireCleanWorkingTreeBeforePull = Boolean(parsed.requireCleanWorkingTreeBeforePull);

  const repoRoot = path.resolve('.');
  const resolvedBackupRoot = path.resolve(repoRoot, backupRoot);
  const contentRoot = path.resolve(repoRoot, 'src/content');

  if (resolvedBackupRoot === contentRoot || isSubPath(contentRoot, resolvedBackupRoot)) {
    throw new Error('backupRoot must be outside src/content.');
  }

  return {
    configPath: CONFIG_PATH,
    repoRoot,
    vaultRoot,
    mappings,
    includeExtensions,
    backupRoot,
    resolvedBackupRoot,
    staleFilePolicy,
    defaultCommitMessage,
    requireCleanWorkingTreeBeforePull,
    hasCloudMappings,
    campaignCloud,
  };
}
