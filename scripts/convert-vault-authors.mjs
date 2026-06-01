#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_VAULT_PATH = '/home/brad/gaming/aletheia-vault';
const SKIPPED_DIRS = new Set(['.git', 'node_modules']);

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const positional = args.filter((arg) => !arg.startsWith('--'));

  return {
    vaultPath: positional[0] || DEFAULT_VAULT_PATH,
    dryRun: flags.has('--dry-run'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

function printHelp() {
  console.log(`Convert Obsidian markdown frontmatter authors fields to YAML block arrays.

Usage:
  node ./scripts/convert-vault-authors.mjs [vault-path] [--dry-run]

Examples:
  node ./scripts/convert-vault-authors.mjs --dry-run
  node ./scripts/convert-vault-authors.mjs
  node ./scripts/convert-vault-authors.mjs /path/to/vault
`);
}

async function collectMarkdownFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        files.push(...await collectMarkdownFiles(entryPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

function findFrontmatterEnd(lines) {
  if (lines[0] !== '---') {
    return -1;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---' || lines[index] === '...') {
      return index;
    }
  }

  return -1;
}

function splitInlineArray(value) {
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const items = [];
  let current = '';
  let quote = null;

  for (const char of inner) {
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      current += char;
      continue;
    }

    if (char === quote) {
      quote = null;
      current += char;
      continue;
    }

    if (char === ',' && quote === null) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  const last = trimmed.at(-1);

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function convertAuthorsLine(line) {
  const match = /^(\s*)authors:\s*(.*?)\s*$/.exec(line);
  if (!match) {
    return null;
  }

  const [, indent, rawValue] = match;
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  const authors = value.startsWith('[') && value.endsWith(']')
    ? splitInlineArray(value).map(stripWrappingQuotes)
    : [stripWrappingQuotes(value)];

  return [
    `${indent}authors:`,
    ...authors.map((author) => `${indent}  - ${author}`),
  ];
}

function convertFileContent(content) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const frontmatterEnd = findFrontmatterEnd(lines);

  if (frontmatterEnd === -1) {
    return { changed: false, content };
  }

  const nextLines = [];
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0 && index < frontmatterEnd) {
      const converted = convertAuthorsLine(lines[index]);
      if (converted) {
        nextLines.push(...converted);
        changed = true;
        continue;
      }
    }

    nextLines.push(lines[index]);
  }

  return {
    changed,
    content: changed ? nextLines.join(newline) : content,
  };
}

async function run() {
  const { vaultPath, dryRun, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    return;
  }

  const vaultRoot = path.resolve(vaultPath);
  const stat = await fs.stat(vaultRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Vault path is not a directory: ${vaultRoot}`);
  }

  const markdownFiles = await collectMarkdownFiles(vaultRoot);
  const changedFiles = [];

  for (const filePath of markdownFiles) {
    const original = await fs.readFile(filePath, 'utf8');
    const result = convertFileContent(original);

    if (!result.changed) {
      continue;
    }

    changedFiles.push(filePath);

    if (!dryRun) {
      await fs.writeFile(filePath, result.content, 'utf8');
    }
  }

  const action = dryRun ? 'Would update' : 'Updated';
  console.log(`${action} ${changedFiles.length} of ${markdownFiles.length} markdown file(s).`);

  for (const filePath of changedFiles) {
    console.log(`- ${path.relative(vaultRoot, filePath).split(path.sep).join('/')}`);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
