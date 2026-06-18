#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationFromLegacyStatus } from './publication-policy.mjs';

export function createPublicationTemplateFields({ contentState = 'unfinished', audienceWarnings = [] } = {}) {
  return {
    publication: 'preview',
    contentState,
    audienceWarnings,
  };
}

export function planPublicationMetadataMigration(frontmatterRecord = {}) {
  return {
    publication: frontmatterRecord.publication ?? publicationFromLegacyStatus(frontmatterRecord.status),
    contentState: frontmatterRecord.contentState ?? 'stable',
    audienceWarnings: Array.isArray(frontmatterRecord.audienceWarnings) ? frontmatterRecord.audienceWarnings : [],
  };
}

function parseFlatFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  const frontmatter = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '---') {
      return frontmatter;
    }

    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (match) {
      frontmatter[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return null;
}

async function main(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    console.log('Usage: node scripts/content-sync/publication-frontmatter-migration.mjs <file.md> [...]');
    console.log('New-content template defaults:');
    console.log(JSON.stringify(createPublicationTemplateFields(), null, 2));
    return;
  }

  for (const file of files) {
    const absolute = path.resolve(file);
    const text = await fs.readFile(absolute, 'utf8');
    const frontmatter = parseFlatFrontmatter(text);
    if (!frontmatter) {
      console.log(`${file}: missing or malformed frontmatter`);
      continue;
    }

    console.log(`${file}: ${JSON.stringify(planPublicationMetadataMigration(frontmatter))}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv);
}
