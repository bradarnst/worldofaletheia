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

function normalizeRepoPath(value, index, label) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().split('\\').join('/');
  if (path.isAbsolute(normalized) || normalized.includes('..')) {
    throw new Error(`Mapping #${index + 1} has invalid ${label} path: ${value}`);
  }

  return normalized;
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
    const normalizedTo = normalizeRepoPath(to, index, 'destination');
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

  const localCleanupPath = normalizeRepoPath(mapping.localCleanupPath, index, 'localCleanupPath');
  const collection = typeof mapping.collection === 'string' && mapping.collection.trim()
    ? mapping.collection.trim()
    : null;

  return { from, to: normalizedCloudPrefix, target, localCleanupPath, collection };
}

function normalizeContentCloudConfig(rawConfig, { requireCredentials = true } = {}) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('contentCloud configuration is required when cloud mappings exist.');
  }

  const bucket = String(rawConfig.bucket || '').trim();
  const accountId = String(rawConfig.accountId || '').trim();
  const region = String(rawConfig.region || 'auto').trim();
  const endpoint = String(rawConfig.endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).trim();
  const prefix = trimSlashes(String(rawConfig.prefix || 'content').trim());
  const accessKeyIdEnv = String(rawConfig.accessKeyIdEnv || 'R2_ACCESS_KEY_ID').trim();
  const secretAccessKeyEnv = String(rawConfig.secretAccessKeyEnv || 'R2_SECRET_ACCESS_KEY').trim();

  if (!bucket) {
    throw new Error('contentCloud.bucket is required.');
  }
  if (!accountId) {
    throw new Error('contentCloud.accountId is required.');
  }
  if (!endpoint) {
    throw new Error('contentCloud.endpoint is required.');
  }

  let credentials = null;
  if (requireCredentials) {
    const accessKeyId = process.env[accessKeyIdEnv];
    const secretAccessKey = process.env[secretAccessKeyEnv];

    if (!accessKeyId) {
      throw new Error(`Environment variable ${accessKeyIdEnv} is required for contentCloud access.`);
    }
    if (!secretAccessKey) {
      throw new Error(`Environment variable ${secretAccessKeyEnv} is required for contentCloud access.`);
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
    prefix,
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
  const contentCloud = hasCloudMappings
    ? normalizeContentCloudConfig(parsed.contentCloud || parsed.campaignCloud, { requireCredentials: requireCloudCredentials })
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
    contentCloud,
    campaignCloud: contentCloud,
  };
}
