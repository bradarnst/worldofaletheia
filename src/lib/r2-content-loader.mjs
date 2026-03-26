import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

let cachedConfig = null;
let cachedClient = null;
let cachedParseFrontmatter = null;

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

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

function loadContentCloudConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'config/content-sync.config.json');
  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configured = rawConfig.contentCloud ?? rawConfig.campaignCloud;
  if (!configured) {
    throw new Error('contentCloud configuration is required when CONTENT_SOURCE_MODE=cloud.');
  }

  const bucket = String(configured.bucket ?? '').trim();
  const accountId = String(configured.accountId ?? '').trim();
  const endpoint = String(
    configured.endpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
  ).trim();
  const region = String(configured.region ?? 'auto').trim();
  const prefix = trimSlashes(String(configured.prefix ?? 'content').trim());
  const accessKeyIdEnv = String(configured.accessKeyIdEnv ?? 'R2_ACCESS_KEY_ID').trim();
  const secretAccessKeyEnv = String(configured.secretAccessKeyEnv ?? 'R2_SECRET_ACCESS_KEY').trim();

  if (!bucket || !endpoint) {
    throw new Error('contentCloud.bucket and contentCloud.endpoint/accountId must be configured.');
  }

  cachedConfig = {
    bucket,
    endpoint,
    region,
    prefix,
    accessKeyIdEnv,
    secretAccessKeyEnv,
  };
  return cachedConfig;
}

function getS3Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = loadContentCloudConfig();
  const accessKeyId = process.env[config.accessKeyIdEnv];
  const secretAccessKey = process.env[config.secretAccessKeyEnv];

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `Environment variables ${config.accessKeyIdEnv} and ${config.secretAccessKeyEnv} are required when CONTENT_SOURCE_MODE=cloud.`,
    );
  }

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

function concatChunks(chunks) {
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
}

async function bodyToString(body) {
  if (!body) {
    throw new Error('Empty body received from content cloud storage.');
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }

  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }

  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes).toString('utf8');
  }

  if (typeof body.transformToWebStream === 'function') {
    const stream = Readable.fromWeb(body.transformToWebStream());
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return concatChunks(chunks).toString('utf8');
  }

  if (typeof body.pipe === 'function') {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    return concatChunks(chunks).toString('utf8');
  }

  throw new Error('Unsupported body type from content cloud storage.');
}

async function getObjectText(key) {
  const config = loadContentCloudConfig();
  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  return bodyToString(response.Body);
}

function buildManifestKey(collection) {
  const config = loadContentCloudConfig();
  const manifestPath = `manifests/${collection}.json`;
  return config.prefix ? `${config.prefix}/${manifestPath}` : manifestPath;
}

function normalizeManifestEntry(entry, collection) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`Invalid manifest entry for collection ${collection}.`);
  }

  const id = String(entry.id ?? '').trim();
  const key = String(entry.key ?? '').trim();
  if (!id || !key) {
    throw new Error(`Manifest entry in ${collection} is missing required id/key fields.`);
  }

  return {
    collection,
    id,
    slug: typeof entry.slug === 'string' ? entry.slug : undefined,
    path: typeof entry.path === 'string' ? entry.path : undefined,
    key,
    etag: typeof entry.etag === 'string' ? entry.etag : undefined,
    lastModified: typeof entry.lastModified === 'string' ? entry.lastModified : undefined,
    visibility: typeof entry.visibility === 'string' ? entry.visibility : undefined,
    campaignSlug: typeof entry.campaignSlug === 'string'
      ? entry.campaignSlug
      : entry.campaignSlug === null
        ? null
        : undefined,
  };
}

async function readManifest(collection) {
  const key = buildManifestKey(collection);
  try {
    const rawText = await getObjectText(key);
    const parsed = JSON.parse(rawText);

    if (!Array.isArray(parsed.entries)) {
      throw new Error(`Manifest for ${collection} is missing entries.`);
    }

    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      collection,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      entries: parsed.entries.map((entry) => normalizeManifestEntry(entry, collection)),
    };
  } catch (err) {
    // Manifest doesn't exist - return empty collection
    if (err.name === 'NoSuchKey' || err.message?.includes('NoSuchKey')) {
      return { version: 1, collection, generatedAt: '', entries: [] };
    }
    throw err;
  }
}

export function createR2MarkdownCollectionLoader(collection) {
  return {
    name: `woa-r2-${collection}`,
    async load(context) {
      context.store.clear();
      const manifest = await readManifest(collection);
      const parseFrontmatter = await getParseFrontmatter();

      // Valid type values per collection (for data sanitization)
      const VALID_TYPES = {
        lore: ['cosmology', 'religion', 'economy', 'history', 'geography', 'food_and_drink', 'culture', 'language', 'warfare', 'domestication', 'magic', 'technology', 'structure', 'other', 'event'],
        places: ['location', 'landmark', 'dungeon', 'settlement', 'region', 'inhabitants', 'water'],
        sentients: ['race', 'species', 'culture', 'organization', 'deity'],
        bestiary: ['monster', 'animal', 'beast', 'spirit', 'construct', 'elemental'],
        flora: ['tree', 'flower', 'fungus', 'herb', 'fruit', 'plant', 'crop'],
        factions: ['political', 'guild', 'criminal', 'government', 'religion', 'military', 'police', 'school', 'order'],
        systems: ['general', 'gurps'],
        sessions: ['session', 'encounter', 'battle', 'note'],
        campaignLore: ['cosmology', 'religion', 'economy', 'history', 'geography', 'food_and_drink', 'culture', 'language', 'warfare', 'domestication', 'magic', 'technology', 'structure', 'other'],
        campaignPlaces: ['location', 'landmark', 'dungeon', 'settlement', 'region', 'inhabitants', 'water'],
        campaignSentients: ['race', 'species', 'culture', 'organization', 'deity'],
        campaignBestiary: ['monster', 'animal', 'beast', 'spirit', 'construct', 'elemental'],
        campaignFlora: ['tree', 'flower', 'fungus', 'herb', 'fruit', 'plant', 'crop'],
        campaignFactions: ['political', 'guild', 'criminal', 'government', 'religion', 'military', 'police', 'school', 'order'],
        campaignSystems: ['general', 'gurps'],
        campaignCharacters: ['pc', 'npc', 'ally', 'adversary', 'patron', 'creature', 'group', 'other'],
        campaignScenes: ['scene', 'combat', 'social', 'travel', 'downtime', 'investigation', 'flashback', 'other'],
        campaignAdventures: ['arc', 'mission', 'quest', 'contract', 'dungeon', 'journey', 'heist', 'other'],
        campaignHooks: ['rumor', 'lead', 'job', 'threat', 'mystery', 'opportunity', 'other'],
      };

      for (const entry of manifest.entries) {
        const markdown = await getObjectText(entry.key);
        const { frontmatter, content } = parseFrontmatter(markdown);
        
        // Inject campaign field from manifest for campaign family collections
        const enrichedFrontmatter = { ...frontmatter };
        if (entry.campaignSlug && !enrichedFrontmatter.campaign) {
          enrichedFrontmatter.campaign = entry.campaignSlug;
        }
        
        // Sanitize type field if it has invalid values
        const validTypes = VALID_TYPES[collection];
        if (validTypes) {
          let typeVal = enrichedFrontmatter.type ? String(enrichedFrontmatter.type).trim() : '';
          // Determine fallback: prefer 'location' for places, 'other' for others, else first valid
          const getFallback = () => {
            if (validTypes.includes('location')) return 'location';
            if (validTypes.includes('other')) return 'other';
            return validTypes[0];
          };
          // Handle missing, malformed, or invalid type values
          if (!typeVal || typeVal.includes(':') || typeVal.includes(' ') || !validTypes.includes(typeVal)) {
            if (typeVal && !validTypes.includes(typeVal)) {
              console.warn(`[r2-loader] ${collection}: invalid type "${typeVal}" for ${entry.id}, falling back to "${getFallback()}"`);
            }
            typeVal = getFallback();
            enrichedFrontmatter.type = typeVal;
          }
        }
        
        const data = await context.parseData({
          id: entry.id,
          data: enrichedFrontmatter,
          filePath: `cloud://${entry.key}`,
        });
        context.store.set({
          id: entry.id,
          data,
          body: content,
          filePath: `cloud://${entry.key}`,
        });
      }
    },
  };
}
