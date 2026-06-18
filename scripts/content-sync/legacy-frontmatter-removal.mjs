#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { collectVaultMarkdownFiles } from './publication-frontmatter-migration.mjs';
import { fail, getSupportCode, normalizePathForDisplay, ok, printErrorDetails, step, support } from './utils.mjs';

const LEGACY_KEYS = ['status', 'secret'];

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function parseFrontmatterBlock(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      return { lines, closeIndex: index };
    }
  }

  return null;
}

function getLegacyKeyForLine(line) {
  for (const key of LEGACY_KEYS) {
    if (new RegExp(`^${key}\\s*:`).test(line)) {
      return key;
    }
  }

  return null;
}

export function removeLegacyFrontmatterText(text) {
  const parsed = parseFrontmatterBlock(text);
  if (!parsed) {
    return {
      changed: false,
      text,
      removedKeys: [],
      reason: 'missing or malformed frontmatter',
    };
  }

  const removedKeys = [];
  const frontmatterLines = parsed.lines.slice(1, parsed.closeIndex).filter((line) => {
    const legacyKey = getLegacyKeyForLine(line);
    if (!legacyKey) {
      return true;
    }

    removedKeys.push(legacyKey);
    return false;
  });

  if (removedKeys.length === 0) {
    return {
      changed: false,
      text,
      removedKeys: [],
      reason: 'no legacy frontmatter keys present',
    };
  }

  const nextLines = [
    parsed.lines[0],
    ...frontmatterLines,
    ...parsed.lines.slice(parsed.closeIndex),
  ];

  return {
    changed: true,
    text: nextLines.join(detectNewline(text)),
    removedKeys,
    reason: null,
  };
}

export async function removeLegacyFrontmatterFiles({ files, write = false, labelRoot = process.cwd() }) {
  const results = [];
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const migration = removeLegacyFrontmatterText(text);
    if (write && migration.changed) {
      await fs.writeFile(file, migration.text, 'utf8');
    }

    results.push({
      file,
      displayPath: normalizePathForDisplay(path.relative(labelRoot, file)),
      changed: migration.changed,
      removedKeys: migration.removedKeys,
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
  console.log('  pnpm content:legacy:migration:plan              # dry-run all configured vault markdown files');
  console.log('  pnpm content:legacy:migration:plan -- --write   # remove legacy keys from configured vault markdown files');
  console.log('  node scripts/content-sync/legacy-frontmatter-removal.mjs [--write] <file.md> [...]');
  console.log('Removes top-level legacy frontmatter keys only: status, secret');
}

function summarizeKeyCounts(results) {
  const counts = new Map();
  for (const result of results) {
    for (const key of result.removedKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function printResults(results, { write }) {
  const changed = results.filter((result) => result.changed);
  const skipped = results.filter((result) => !result.changed && result.reason !== 'no legacy frontmatter keys present');
  const action = write ? 'Updated' : 'Would update';

  step(write ? 'Apply legacy frontmatter removal' : 'Plan legacy frontmatter removal');
  console.log(`${action} ${changed.length} of ${results.length} markdown file(s).`);

  const keyCounts = summarizeKeyCounts(results);
  if (keyCounts.length > 0) {
    console.log(`Removed keys: ${keyCounts.map(([key, count]) => `${key}=${count}`).join(', ')}`);
  }

  for (const result of changed.slice(0, 50)) {
    console.log(`- ${result.displayPath}: remove ${result.removedKeys.join(', ')}`);
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
    ok(`Legacy frontmatter removed from ${changed.length} file(s).`);
  } else {
    ok('Legacy frontmatter removal dry-run complete.');
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

  const results = await removeLegacyFrontmatterFiles({
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
    fail('Legacy frontmatter removal failed.');
    console.log('Action: check the message above and retry.');
    support(supportCode ?? 'LEGACY-FRONTMATTER-REMOVAL-FAILED');
    printErrorDetails(error);
    process.exitCode = 1;
  }
}
