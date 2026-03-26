#!/usr/bin/env node
/**
 * Regenerate Cloudflare R2 manifests from existing content.
 * 
 * This script reads all content from R2, determines correct collection
 * assignments based on path patterns, and regenerates manifests.
 * 
 * Usage: node scripts/content-sync/regenerate-manifests.mjs
 */

import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const CONFIG = {
  bucket: 'woa-campaign-private',
  accountId: '46786d5053cb57765fd5ab5b963de71d',
  prefix: 'content',
  accessKeyIdEnv: 'R2_ACCESS_KEY_ID',
  secretAccessKeyEnv: 'R2_SECRET_ACCESS_KEY',
};

// Collection mapping based on path patterns
const PATH_COLLECTION_MAP = {
  'lore': 'lore',
  'places': 'places',
  'sentients': 'sentients',
  'bestiary': 'bestiary',
  'flora': 'flora',
  'factions': 'factions',
  'systems': 'systems',
  'meta': 'meta',
  'campaigns': 'campaigns',
  'sessions': 'sessions',
  'campaignLore': 'campaignLore',
  'campaignPlaces': 'campaignPlaces',
  'campaignSentients': 'campaignSentients',
  'campaignBestiary': 'campaignBestiary',
  'campaignFlora': 'campaignFlora',
  'campaignFactions': 'campaignFactions',
  'campaignSystems': 'campaignSystems',
  'campaignMeta': 'campaignMeta',
  'campaignCharacters': 'campaignCharacters',
  'campaignScenes': 'campaignScenes',
  'campaignAdventures': 'campaignAdventures',
  'campaignHooks': 'campaignHooks',
};

// Family segment to collection mapping
const FAMILY_COLLECTIONS = {
  lore: 'campaignLore',
  places: 'campaignPlaces',
  sentients: 'campaignSentients',
  bestiary: 'campaignBestiary',
  flora: 'campaignFlora',
  factions: 'campaignFactions',
  systems: 'campaignSystems',
  meta: 'campaignMeta',
  characters: 'campaignCharacters',
  scenes: 'campaignScenes',
  adventures: 'campaignAdventures',
  hooks: 'campaignHooks',
};

const FAMILY_SEGMENT_PATTERN = Object.keys(FAMILY_COLLECTIONS).join('|');

// Campaign root-level index files
const CAMPAIGN_INDEX_PATTERN = /^([^/]+)\/index\.md$/i;

// Campaign session files: campaigns/{slug}/sessions/{file}.md
const SESSION_PATTERN = /^([^/]+)\/sessions\/([^/]+)\.md$/i;

// Campaign family files: campaigns/{slug}/{family}/{file}.md
const FAMILY_PATTERN = new RegExp(`^([^/]+)\/(${FAMILY_SEGMENT_PATTERN})\/(.+)\\.md$`, 'i');

let cachedParseFrontmatter = null;

async function getParseFrontmatter() {
  if (cachedParseFrontmatter) {
    return cachedParseFrontmatter;
  }

  const pnpmRoot = path.resolve(process.cwd(), 'node_modules/.pnpm');
  const packageDir = fs
    .readdirSync(pnpmRoot)
    .find((entry) => entry.startsWith('@astrojs+markdown-remark@'));
  if (!packageDir) {
    throw new Error('Could not locate @astrojs/markdown-remark in pnpm store.');
  }

  const modulePath = path.join(
    pnpmRoot,
    packageDir,
    'node_modules',
    '@astrojs',
    'markdown-remark',
    'dist',
    'frontmatter.js',
  );
  const module = await import(/* @vite-ignore */ pathToFileURL(modulePath).href);
  cachedParseFrontmatter = module.parseFrontmatter;
  return cachedParseFrontmatter;
}

function buildManifestKey(prefix, collection) {
  const trimmedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  return trimmedPrefix ? `${trimmedPrefix}/manifests/${collection}.json` : `manifests/${collection}.json`;
}

function stripMarkdownExtension(relativePath) {
  return relativePath.replace(/\.md$/i, '');
}

function normalizeNullableString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}

function buildSourceEtag(text) {
  return createHash('md5').update(text).digest('hex');
}

function toCampaignVisibility(value) {
  return value === 'public' || value === 'campaignMembers' || value === 'gm' ? value : null;
}

function determineCollection(key, frontmatter) {
  // Remove .md extension and split path
  const relativePath = key.replace(/\.md$/i, '');
  const segments = relativePath.split('/');
  
  // Root-level collections: lore/, places/, sentients/, etc. (2 segments)
  if (segments.length === 2 && PATH_COLLECTION_MAP[segments[0]]) {
    return segments[0];
  }
  
  // Campaign content starts with "campaigns/" prefix
  if (segments[0] === 'campaigns' && segments.length >= 3) {
    const campaignSlug = segments[1];
    const familySegment = segments[2].toLowerCase();
    
    // Campaign index file: campaigns/{slug}/Campaign - {slug}.md
    if (familySegment !== 'sessions' && familySegment !== 'lore' && 
        familySegment !== 'places' && familySegment !== 'sentients' &&
        familySegment !== 'bestiary' && familySegment !== 'flora' &&
        familySegment !== 'factions' && familySegment !== 'systems' &&
        familySegment !== 'meta' && familySegment !== 'characters' &&
        familySegment !== 'scenes' && familySegment !== 'adventures' &&
        familySegment !== 'hooks') {
      // This is a campaign index file (e.g., "Campaign - Barry.md")
      return 'campaigns';
    }
    
    // Sessions: campaigns/{slug}/sessions/{file}.md
    if (familySegment === 'sessions') {
      return 'sessions';
    }
    
    // Campaign family content: campaigns/{slug}/{family}/{file}.md
    const collection = FAMILY_COLLECTIONS[familySegment];
    if (collection) {
      return collection;
    }
  }
  
  // Fallback: check frontmatter.collection
  if (frontmatter && frontmatter.collection) {
    const col = frontmatter.collection;
    if (PATH_COLLECTION_MAP[col]) {
      return col;
    }
  }
  
  return null;
}

async function getS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env[CONFIG.accessKeyIdEnv],
      secretAccessKey: process.env[CONFIG.secretAccessKeyEnv],
    },
  });
}

async function listAllObjects(client, prefix = '') {
  const results = [];
  let continuationToken;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: CONFIG.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await client.send(command);
    results.push(...(response.Contents || []).map(c => c.Key));
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return results;
}

async function getObjectText(client, key) {
  const command = new GetObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key,
  });
  const response = await client.send(command);
  
  if (typeof response.Body.transformToString === 'function') {
    return await response.Body.transformToString();
  }
  if (typeof response.Body.transformToByteArray === 'function') {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes).toString('utf8');
  }
  throw new Error('Unsupported body type');
}

async function putObjectText(client, key, text, contentType = 'application/json') {
  const command = new PutObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key,
    Body: text,
    ContentType: contentType,
  });
  await client.send(command);
}

async function main() {
  console.log('Starting manifest regeneration...\n');
  
  const client = await getS3Client();
  const parseFrontmatter = await getParseFrontmatter();
  
  // List all objects in R2
  console.log('Fetching object list from R2...');
  const allKeys = await listAllObjects(client);
  
  // Filter to only .md files at correct content paths (not manifests)
  const contentKeys = allKeys.filter(key => 
    key.endsWith('.md') && 
    !key.includes('/manifests/') &&
    !key.includes('/_index')
  );
  
  console.log(`Found ${contentKeys.length} content files\n`);
  
  // Process each file and organize by collection
  const manifestEntries = new Map();
  const errors = [];
  
  for (const key of contentKeys) {
    try {
      const text = await getObjectText(client, key);
      const { frontmatter } = parseFrontmatter(text);
      const frontmatterRecord = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
      
      const collection = determineCollection(key, frontmatterRecord);
      if (!collection) {
        errors.push(`Could not determine collection for: ${key}`);
        continue;
      }
      
      // Extract campaign slug for campaign content
      let campaignSlug = null;
      const segments = key.replace(/\.md$/i, '').split('/');
      
      if (segments[0] === 'campaigns' && segments.length >= 2) {
        campaignSlug = segments[1];
      }
      
      // Build manifest entry
      const relativePath = key.replace(/\.md$/i, '');
      const id = relativePath;
      
      // Determine slug from frontmatter or path
      let slug = normalizeNullableString(frontmatterRecord.slug);
      if (!slug) {
        if (collection === 'campaigns') {
          // Campaign slug from path
          slug = segments.length >= 2 ? segments[1] : id;
        } else if (collection === 'sessions') {
          // Session filename (last segment without extension)
          slug = segments.length >= 3 ? segments[segments.length - 1] : id;
        } else {
          // Last segment of path
          slug = segments[segments.length - 1];
        }
      }
      
      const entry = {
        collection,
        id,
        slug,
        path: relativePath,
        key,  // Use actual R2 key
        etag: buildSourceEtag(text),
        lastModified: new Date().toISOString(),
        visibility: toCampaignVisibility(frontmatterRecord.visibility),
        campaignSlug,
      };
      
      if (!manifestEntries.has(collection)) {
        manifestEntries.set(collection, []);
      }
      manifestEntries.get(collection).push(entry);
      
    } catch (err) {
      errors.push(`Error processing ${key}: ${err.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log('Errors encountered:');
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    console.log('');
  }
  
  // Generate and upload manifests
  console.log(`Generating manifests for ${manifestEntries.size} collections...\n`);
  
  const manifestPrefix = CONFIG.prefix || '';
  const writtenKeys = [];
  
  for (const [collection, entries] of manifestEntries.entries()) {
    // Sort entries by id
    entries.sort((a, b) => a.id.localeCompare(b.id));
    
    const manifest = {
      version: 1,
      collection,
      generatedAt: new Date().toISOString(),
      entries,
    };
    
    const key = buildManifestKey(manifestPrefix, collection);
    
    try {
      await putObjectText(client, key, JSON.stringify(manifest, null, 2) + '\n');
      writtenKeys.push(key);
      console.log(`  Written: ${key} (${entries.length} entries)`);
    } catch (err) {
      console.error(`  Failed to write ${key}: ${err.message}`);
    }
  }
  
  // Write index manifest
  const indexManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    collections: Array.from(manifestEntries.entries()).map(([collection, entries]) => ({
      collection,
      count: entries.length,
      key: buildManifestKey(manifestPrefix, collection),
    })),
  };
  
  const indexKey = buildManifestKey(manifestPrefix, '_index');
  await putObjectText(client, indexKey, JSON.stringify(indexManifest, null, 2) + '\n');
  writtenKeys.push(indexKey);
  
  console.log(`\nRegeneration complete. Written ${writtenKeys.length} manifest files.`);
  
  // Print summary
  console.log('\nCollection summary:');
  for (const [collection, entries] of [...manifestEntries.entries()].sort()) {
    console.log(`  ${collection}: ${entries.length} entries`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});