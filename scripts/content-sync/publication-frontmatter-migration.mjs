#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { publicationFromLegacyStatus } from './publication-policy.mjs';
import { fail, getSupportCode, normalizePathForDisplay, ok, printErrorDetails, step, support } from './utils.mjs';

export function createPublicationTemplateFields({ contentState = 'unfinished', audienceWarnings = [] } = {}) {
  return {
    publication: 'preview',
    contentState,
    audienceWarnings,
  };
}

export function planPublicationMetadataMigration(frontmatterRecord = {}) {
  return {
    publication: frontmatterRecord.publication ?? publicationFromLegacyStatus(frontmatterRecord.status) ?? 'preview',
    contentState: frontmatterRecord.contentState ?? 'stable',
    audienceWarnings: Array.isArray(frontmatterRecord.audienceWarnings) ? frontmatterRecord.audienceWarnings : [],
  };
}

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function parseFrontmatterBlock(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  const frontmatter = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '---') {
      return { frontmatter, lines, closeIndex: index };
    }

    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (match) {
      frontmatter[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return null;
}

function hasFrontmatterKey(lines, closeIndex, key) {
  const pattern = new RegExp(`^${key}\\s*:`);
  return lines.slice(1, closeIndex).some((line) => pattern.test(line));
}

function formatFrontmatterValue(key, value) {
  if (key === 'audienceWarnings') {
    return Array.isArray(value) && value.length > 0
      ? `audienceWarnings: [${value.join(', ')}]`
      : 'audienceWarnings: []';
  }

  return `${key}: ${value}`;
}

export function migratePublicationFrontmatterText(text) {
  const parsed = parseFrontmatterBlock(text);
  if (!parsed) {
    return {
      changed: false,
      text,
      addedKeys: [],
      reason: 'missing or malformed frontmatter',
    };
  }

  const plan = planPublicationMetadataMigration(parsed.frontmatter);
  const additions = [];
  for (const key of ['publication', 'contentState', 'audienceWarnings']) {
    if (!hasFrontmatterKey(parsed.lines, parsed.closeIndex, key)) {
      additions.push(formatFrontmatterValue(key, plan[key]));
    }
  }

  if (additions.length === 0) {
    return {
      changed: false,
      text,
      addedKeys: [],
      reason: 'publication metadata already present',
    };
  }

  const nextLines = [
    ...parsed.lines.slice(0, parsed.closeIndex),
    ...additions,
    ...parsed.lines.slice(parsed.closeIndex),
  ];

  return {
    changed: true,
    text: nextLines.join(detectNewline(text)),
    addedKeys: additions.map((line) => line.split(':')[0]),
    reason: null,
  };
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdownFiles(root) {
  const files = [];
  if (!(await pathExists(root))) {
    return files;
  }

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(absolute);
      }
    }
  }

  await walk(root);
  return files;
}

export async function collectVaultMarkdownFiles(config) {
  const roots = [...new Set(config.mappings.map((mapping) => path.resolve(config.vaultRoot, mapping.from)))];
  const filesByPath = new Map();
  for (const root of roots) {
    for (const file of await walkMarkdownFiles(root)) {
      filesByPath.set(file, file);
    }
  }

  return [...filesByPath.values()].sort((left, right) => left.localeCompare(right));
}

export async function migratePublicationFrontmatterFiles({ files, write = false, labelRoot = process.cwd() }) {
  const results = [];
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const migration = migratePublicationFrontmatterText(text);
    if (write && migration.changed) {
      await fs.writeFile(file, migration.text, 'utf8');
    }

    results.push({
      file,
      displayPath: normalizePathForDisplay(path.relative(labelRoot, file)),
      changed: migration.changed,
      addedKeys: migration.addedKeys,
      reason: migration.reason,
    });
  }

  return results;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const write = args.includes('--write');
  const help = args.includes('--help') || args.includes('-h');
  const files = args.filter((arg) => !arg.startsWith('--'));
  return { write, help, files };
}

function printUsage() {
  console.log('Usage:');
  console.log('  pnpm content:publication:migration:plan           # dry-run all configured vault markdown files');
  console.log('  pnpm content:publication:migration:plan -- --write # update configured vault markdown files');
  console.log('  node scripts/content-sync/publication-frontmatter-migration.mjs [--write] <file.md> [...]');
  console.log('New-content template defaults:');
  console.log(JSON.stringify(createPublicationTemplateFields(), null, 2));
}

function printResults(results, { write }) {
  const changed = results.filter((result) => result.changed);
  const skipped = results.filter((result) => !result.changed && result.reason !== 'publication metadata already present');
  const action = write ? 'Updated' : 'Would update';

  step(write ? 'Apply publication frontmatter migration' : 'Plan publication frontmatter migration');
  console.log(`${action} ${changed.length} of ${results.length} markdown file(s).`);

  for (const result of changed.slice(0, 50)) {
    console.log(`- ${result.displayPath}: add ${result.addedKeys.join(', ')}`);
  }

  if (changed.length > 50) {
    console.log(`- ...and ${changed.length - 50} more file(s)`);
  }

  if (skipped.length > 0) {
    console.log('\nSkipped files:');
    for (const result of skipped.slice(0, 20)) {
      console.log(`- ${result.displayPath}: ${result.reason}`);
    }
    if (skipped.length > 20) {
      console.log(`- ...and ${skipped.length - 20} more skipped file(s)`);
    }
  }

  if (!write && changed.length > 0) {
    console.log('\nDry-run only. Re-run with --write to update files.');
  }

  if (write) {
    ok(`Publication frontmatter migration applied to ${changed.length} file(s).`);
  } else {
    ok('Publication frontmatter migration dry-run complete.');
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }

  const config = args.files.length > 0
    ? null
    : await loadConfig({ requireCloudCredentials: false });
  const files = args.files.length > 0
    ? args.files.map((file) => path.resolve(file))
    : await collectVaultMarkdownFiles(config);

  if (files.length === 0) {
    console.log('No markdown files found to migrate.');
    return;
  }

  const results = await migratePublicationFrontmatterFiles({
    files,
    write: args.write,
    labelRoot: config?.vaultRoot ?? process.cwd(),
  });
  printResults(results, { write: args.write });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv);
  } catch (error) {
    const supportCode = getSupportCode(error);
    fail('Publication frontmatter migration failed.');
    console.log('Action: check the message above and retry.');
    support(supportCode ?? 'PUBLICATION-FRONTMATTER-MIGRATION-FAILED');
    printErrorDetails(error);
    process.exitCode = 1;
  }
}
