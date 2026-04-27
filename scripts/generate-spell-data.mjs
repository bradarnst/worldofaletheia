#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultSourcePath = path.join(repoRoot, 'src/data/spells/spells-raw.json');
const outputDataPath = path.join(repoRoot, 'src/data/spells/spells-raw.json');
const outputTypesPath = path.join(repoRoot, 'src/data/spells/spell-types.json');

const REQUIRED_STRING_FIELDS = ['spell_name', 'spell_type'];
const DISPLAY_STRING_FIELDS = ['keywords', 'full_cost', 'casting_roll', 'range', 'duration', 'description', 'statistics'];

function slugifySpellType(value) {
  return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function slugifySpellName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function usage() {
  console.error('Usage: node scripts/generate-spell-data.mjs [source-json-path] [--validate-only]');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  let sourcePath = defaultSourcePath;
  let validateOnly = false;

  for (const arg of argv) {
    if (arg === '--validate-only') {
      validateOnly = true;
      continue;
    }

    if (arg.startsWith('--')) {
      usage();
      fail(`Unknown option: ${arg}`);
    }

    sourcePath = path.resolve(process.cwd(), arg);
  }

  return { sourcePath, validateOnly };
}

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(message);
  }

  return value;
}

function buildNormalizedSpell(rawSpell, index, warnings) {
  const spell = ensureObject(rawSpell, `Spell at index ${index} is not an object.`);
  const normalizedSpell = {};

  for (const field of REQUIRED_STRING_FIELDS) {
    const normalizedValue = normalizeString(spell[field]);
    if (!normalizedValue) {
      fail(`Spell at index ${index} is missing required field "${field}".`);
    }

    normalizedSpell[field] = normalizedValue;
  }

  for (const field of DISPLAY_STRING_FIELDS) {
    const normalizedValue = normalizeString(spell[field]);
    if (!normalizedValue) {
      warnings.push(`Spell "${normalizedSpell.spell_name}" has an empty ${field} field after normalization.`);
    }

    normalizedSpell[field] = normalizedValue;
  }

  return normalizedSpell;
}

function collectDuplicates(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function summarizeWarnings(warnings) {
  if (warnings.length === 0) {
    return [];
  }

  return warnings.length <= 20 ? warnings : [...warnings.slice(0, 20), `... ${warnings.length - 20} additional warnings omitted.`];
}

async function main() {
  const { sourcePath, validateOnly } = parseArgs(process.argv.slice(2));
  const rawText = await readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(rawText);
  const root = ensureObject(parsed, 'Top-level JSON value must be an object.');
  const metadata = ensureObject(root.metadata ?? {}, 'Top-level metadata must be an object.');
  const spells = root.spells;

  if (!Array.isArray(spells)) {
    fail('Top-level spells field must be an array.');
  }

  const warnings = [];
  const normalizedSpells = spells.map((spell, index) => buildNormalizedSpell(spell, index, warnings));
  const spellTypes = [...new Set(normalizedSpells.map((spell) => spell.spell_type))].sort();
  const duplicateSpellNames = collectDuplicates(normalizedSpells.map((spell) => spell.spell_name));
  const duplicateTypeSlugs = collectDuplicates(spellTypes.map((spellType) => slugifySpellType(spellType)));
  const duplicateLegacyModalIds = collectDuplicates(normalizedSpells.map((spell) => `spell-modal-${slugifySpellName(spell.spell_name)}`));

  if (duplicateTypeSlugs.length > 0) {
    fail(`Duplicate spell type slugs detected: ${duplicateTypeSlugs.map(([value]) => value).join(', ')}`);
  }

  if (typeof metadata.totalSpells === 'number' && metadata.totalSpells !== normalizedSpells.length) {
    warnings.push(`metadata.totalSpells (${metadata.totalSpells}) did not match parsed spell count (${normalizedSpells.length}); generated output will use the parsed count.`);
  }

  if (duplicateSpellNames.length > 0) {
    warnings.push(`Duplicate spell names detected: ${duplicateSpellNames.slice(0, 10).map(([name, count]) => `${name} (${count})`).join(', ')}`);
  }

  if (duplicateLegacyModalIds.length > 0) {
    warnings.push(`Duplicate legacy modal IDs detected: ${duplicateLegacyModalIds.slice(0, 10).map(([name, count]) => `${name} (${count})`).join(', ')}`);
  }

  const normalizedData = {
    metadata: {
      ...metadata,
      totalSpells: normalizedSpells.length,
    },
    spells: normalizedSpells,
  };

  const summary = {
    sourcePath,
    validateOnly,
    totalSpells: normalizedSpells.length,
    totalTypes: spellTypes.length,
    duplicateSpellNames: duplicateSpellNames.slice(0, 20),
    duplicateLegacyModalIds: duplicateLegacyModalIds.slice(0, 20),
    warningCount: warnings.length,
    warnings: summarizeWarnings(warnings),
  };

  if (!validateOnly) {
    await Promise.all([
      writeFile(outputDataPath, `${JSON.stringify(normalizedData, null, 2)}\n`, 'utf8'),
      writeFile(outputTypesPath, `${JSON.stringify(spellTypes, null, 2)}\n`, 'utf8'),
    ]);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
