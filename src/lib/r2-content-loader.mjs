import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadCollectionLookupRows } from './content-index-loader.mjs';

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

/**
 * Resolve a relative path against an R2 object key to produce another R2 object key.
 */
function relativeToR2Key(r2Key, relativePath) {
  const segments = r2Key.split('/');
  segments.pop();
  for (const part of relativePath.split('/')) {
    if (part === '..') {
      segments.pop();
    } else if (part !== '.') {
      segments.push(part);
    }
  }
  return segments.join('/');
}

/**
 * Pre-process markdown content to replace relative image paths with R2 handler URLs.
 * This runs BEFORE Astro's markdown processor, so we transform:
 *   ![alt](../../assets/images/X.png) 
 * to:
 *   ![alt](/_content-image?key=assets/images/X.png)
 * 
 * Images are stored at R2 key "assets/images/X.png" (no content/ prefix).
 * Markdown is stored at R2 key "lore/example.md" but images use their own prefix.
 * This way Astro's markdown processor never sees relative paths and won't
 * add __astro_image_ attributes.
 */
function preprocessMarkdownImages(markdown, markdownR2Key) {
  if (!markdownR2Key) {
    return markdown;
  }

  // Match markdown image syntax: ![alt](path) or ![alt](<path>) with angle brackets
  // The path can be wrapped in angle brackets or plain parens
  const imageRegex = /!\[([^\]]*)\]\(<([^>]+)>\)|!\[([^\]]*)\]\(([^)]+)\)/g;
  
  return markdown.replace(imageRegex, (_match, altAngle, srcAngle, altParen, srcParen) => {
    // Two patterns: ![alt](<path>) captures altAngle+srcAngle, or ![alt](path) captures altParen+srcParen
    const alt = altAngle || altParen;
    const src = srcAngle || srcParen;
    if (!src) {
      return _match;
    }
    
    // Skip if already an absolute URL or external
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
      return _match;
    }
    
    // Compute R2 key from relative path - images use assets/images prefix
    // not the markdown's collection prefix
    const imageR2Key = relativeToR2Key(markdownR2Key, src);
    const r2Url = `/api/content-image?key=${encodeURIComponent(imageR2Key)}`;
    
    return `![${alt}](${r2Url})`;
  });
}


export function createR2MarkdownCollectionLoader(collection) {
  return {
    name: `woa-r2-${collection}`,
    async load(context) {
      context.store.clear();
      const entries = await loadCollectionLookupRows(collection);
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

      for (const entry of entries) {
        const markdown = await getObjectText(entry.r2Key);
        const { frontmatter, content } = parseFrontmatter(markdown);
        
        // Inject campaign field from D1 lookup data for campaign family collections
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
          filePath: `cloud://${entry.r2Key}`,
        });

        // Pre-process markdown to replace relative image paths with R2 handler URLs
        // BEFORE Astro's markdown processor runs, so it never sees relative paths
        const preprocessedContent = preprocessMarkdownImages(content, entry.r2Key);

        // Render markdown to HTML using the content layer's markdown processor
        const rendered = await context.renderMarkdown(preprocessedContent, {
          fileURL: `cloud://${entry.r2Key}`,
        });

        context.store.set({
          id: entry.id,
          data,
          body: content,
          filePath: `cloud://${entry.r2Key}`,
          rendered,
        });
      }
    },
  };
}
