import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './content-sync/config.mjs';
import {
  fail,
  info,
  normalizePathForDisplay,
  ok,
  printErrorDetails,
  step,
  support,
  warn,
} from './content-sync/utils.mjs';

function parseArgs(argv) {
  const options = {
    from: '',
    to: '',
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith('--from=')) {
      options.from = arg.slice('--from='.length).trim();
      continue;
    }

    if (arg.startsWith('--to=')) {
      options.to = arg.slice('--to='.length).trim();
    }
  }

  return options;
}

function isValidSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function resolveCampaignsSourceRoot(config) {
  const mapping = config.mappings.find(
    (candidate) =>
      (candidate.target === 'cloud' && candidate.to === 'campaigns')
      || (candidate.target === 'repo' && candidate.to === 'src/content/campaigns'),
  );

  if (!mapping) {
    throw new Error('Could not find a campaigns mapping in config/content-sync.config.json.');
  }

  return path.resolve(config.vaultRoot, mapping.from);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdownFiles(root) {
  const files = [];
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

export function rewriteCampaignFrontmatter(markdown, fromSlug, toSlug) {
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return markdown;
  }

  const originalBlock = frontmatterMatch[1];
  const updatedBlock = originalBlock
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\s*campaign\s*:\s*)(['"]?)([^'"]+)(['"]?)(\s*)$/);
      if (!match) {
        return line;
      }

      const [, prefix, openingQuote, value, closingQuote, suffix] = match;
      if (value.trim() !== fromSlug) {
        return line;
      }

      const quote = openingQuote || closingQuote || '';
      return `${prefix}${quote}${toSlug}${quote}${suffix}`;
    })
    .join('\n');

  if (updatedBlock === originalBlock) {
    return markdown;
  }

  return markdown.replace(originalBlock, updatedBlock);
}

export function renameCampaignSlugInAccessConfig(rawConfig, fromSlug, toSlug) {
  const configObject = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
    ? rawConfig
    : {};
  const hasLegacyGmAssignments = Boolean(
    configObject.gmAssignments && typeof configObject.gmAssignments === 'object' && !Array.isArray(configObject.gmAssignments),
  );
  const memberships = configObject.memberships && typeof configObject.memberships === 'object' && !Array.isArray(configObject.memberships)
    ? configObject.memberships
    : {};
  const gmAssignments = configObject.gmAssignments && typeof configObject.gmAssignments === 'object' && !Array.isArray(configObject.gmAssignments)
    ? configObject.gmAssignments
    : {};

  const updatedMemberships = Object.fromEntries(
    Object.entries(memberships).map(([userId, entry]) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return [userId, entry];
      }

      let campaigns = entry.campaigns;
      if (Array.isArray(entry.campaigns)) {
        campaigns = entry.campaigns.map((campaign) => (campaign === fromSlug ? toSlug : campaign));
      } else if (entry.campaigns && typeof entry.campaigns === 'object') {
        campaigns = Object.fromEntries(
          Object.entries(entry.campaigns).map(([campaignSlug, role]) => [campaignSlug === fromSlug ? toSlug : campaignSlug, role]),
        );
      }

      return [userId, { ...entry, campaigns }];
    }),
  );

  const updatedGmAssignments = {};
  for (const [campaignSlug, value] of Object.entries(gmAssignments)) {
    updatedGmAssignments[campaignSlug === fromSlug ? toSlug : campaignSlug] = value;
  }

  return {
    ...configObject,
    memberships: updatedMemberships,
    ...(hasLegacyGmAssignments ? { gmAssignments: updatedGmAssignments } : {}),
  };
}

async function updateMarkdownFrontmatter(root, fromSlug, toSlug, { dryRun }) {
  const markdownFiles = await walkMarkdownFiles(root);
  const updatedFiles = [];

  for (const filePath of markdownFiles) {
    const original = await fs.readFile(filePath, 'utf8');
    const updated = rewriteCampaignFrontmatter(original, fromSlug, toSlug);
    if (updated === original) {
      continue;
    }

    updatedFiles.push(filePath);
    if (!dryRun) {
      await fs.writeFile(filePath, updated, 'utf8');
    }
  }

  return updatedFiles;
}

async function updateAccessConfig(repoRoot, fromSlug, toSlug, { dryRun }) {
  const accessConfigPath = path.resolve(repoRoot, 'config/campaign-access.config.json');
  if (!await pathExists(accessConfigPath)) {
    return { updated: false, path: accessConfigPath };
  }

  const originalRaw = await fs.readFile(accessConfigPath, 'utf8');
  const parsed = JSON.parse(originalRaw);
  const updated = renameCampaignSlugInAccessConfig(parsed, fromSlug, toSlug);
  if (JSON.stringify(updated) === JSON.stringify(parsed)) {
    return { updated: false, path: accessConfigPath };
  }

  const updatedRaw = `${JSON.stringify(updated, null, 2)}\n`;

  if (!dryRun) {
    await fs.writeFile(accessConfigPath, updatedRaw, 'utf8');
  }

  return { updated: true, path: accessConfigPath };
}

export async function renameCampaignSlug(options) {
  const { from, to, dryRun = false } = options;
  if (!from || !to) {
    throw new Error('Both --from and --to are required.');
  }
  if (!isValidSlug(from) || !isValidSlug(to)) {
    throw new Error('Campaign slugs must be lowercase kebab-case (letters, numbers, hyphens).');
  }
  if (from === to) {
    throw new Error('--from and --to must be different values.');
  }

  const config = await loadConfig({ requireCloudCredentials: false });
  const campaignsSourceRoot = resolveCampaignsSourceRoot(config);
  const fromPath = path.resolve(campaignsSourceRoot, from);
  const toPath = path.resolve(campaignsSourceRoot, to);

  if (!await pathExists(fromPath)) {
    throw new Error(`Source campaign folder does not exist: ${normalizePathForDisplay(fromPath)}`);
  }
  if (await pathExists(toPath)) {
    throw new Error(`Target campaign folder already exists: ${normalizePathForDisplay(toPath)}`);
  }

  step('Rename campaign slug');
  info(`Vault source root: ${normalizePathForDisplay(campaignsSourceRoot)}`);
  info(`Rename: ${from} -> ${to}`);

  if (dryRun) {
    info(`Dry run: would rename ${normalizePathForDisplay(fromPath)} to ${normalizePathForDisplay(toPath)}`);
  } else {
    await fs.rename(fromPath, toPath);
    ok(`Renamed campaign folder to ${normalizePathForDisplay(toPath)}`);
  }

  const effectiveRoot = dryRun ? fromPath : toPath;
  const updatedMarkdownFiles = await updateMarkdownFrontmatter(effectiveRoot, from, to, { dryRun });
  if (updatedMarkdownFiles.length > 0) {
    ok(`${dryRun ? 'Would update' : 'Updated'} ${updatedMarkdownFiles.length} markdown file(s) with campaign frontmatter.`);
  } else {
    info('No nested markdown files required campaign frontmatter updates.');
  }

  const accessConfigResult = await updateAccessConfig(config.repoRoot, from, to, { dryRun });
  if (accessConfigResult.updated) {
    ok(`${dryRun ? 'Would update' : 'Updated'} ${normalizePathForDisplay(accessConfigResult.path)}.`);
  } else if (await pathExists(accessConfigResult.path)) {
    info('No campaign-access config updates were required.');
  } else {
    warn('No config/campaign-access.config.json file found to update.');
  }

  console.log('');
  info(`Next: run pnpm content:sync to propagate ${to} through repo/R2 content.`);
  info('Review any hardcoded /campaigns/<old-slug> links, redirects, or remote D1 membership records separately.');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    await renameCampaignSlug(options);
  } catch (error) {
    fail('Campaign rename failed.');
    console.log('Action: fix the issue above and retry.');
    support('CAMPAIGN-RENAME-FAILED');
    printErrorDetails(error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
