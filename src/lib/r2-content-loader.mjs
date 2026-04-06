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
 * e.g. relativeToR2Key('content/lore/the-orcs.md', '../../assets/images/Orcs.png')
 *   → 'content/assets/images/Orcs.png'
 */
function relativeToR2Key(r2Key, relativePath) {
  const segments = r2Key.split('/');
  // Remove the filename to get the "directory" of the R2 object
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
 * Replace __ASTRO_IMAGE_ attribute values (JSON with relative src)
 * with URLs pointing to the content-image handler. The handler fetches
 * the image from R2 using the computed R2 key.
 * The HTML serializer encodes " as &#x22; in attributes.
 */
function replaceImageAttrsWithR2Urls(html, imagePaths, markdownR2Key) {
  if (!imagePaths || imagePaths.length === 0 || !markdownR2Key) {
    return html;
  }

  // Pre-compute relative path → R2 key for all images in this markdown file
  const relPathToR2Key = new Map();
  for (const relPath of imagePaths) {
    relPathToR2Key.set(relPath, relativeToR2Key(markdownR2Key, relPath));
  }

  // The HTML has __ASTRO_IMAGE_="..." with JSON where src is the relative path.
  // In the attribute, " is encoded as &#x22;.
  const regex = /__ASTRO_IMAGE_="([^"]+)"/g;
  return html.replace(regex, (_full, encodedJson) => {
    // Decode HTML entities to recover the JSON string
    const jsonStr = encodedJson.replaceAll('&#x22;', '"');
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return _full;
    }
    const relPath = parsed.src;
    if (!relPath) {
      return _full;
    }

    const imageR2Key = relPathToR2Key.get(relPath);
    if (!imageR2Key) {
      return _full;
    }

    // Rewrite src to point to our R2 image handler
    parsed.src = `/_content-image?key=${encodeURIComponent(imageR2Key)}`;

    // Re-encode quotes for HTML attribute context
    const outJson = JSON.stringify(parsed).replaceAll('"', '&#x22;');
    return `__ASTRO_IMAGE_="${outJson}"`;
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

        // Render markdown to HTML using the content layer's markdown processor
        // Pass the frontmatter-stripped body content, not the full file
        const rendered = await context.renderMarkdown(content, {
          fileURL: `cloud://${entry.r2Key}`,
        });

        // In cloud mode, __ASTRO_IMAGE_ attributes contain relative paths that
        // Astro's updateImageReferencesInBody() cannot resolve (no imageAssetMap).
        // Post-process the HTML to replace __ASTRO_IMAGE_ attrs with internal
        // image handler URLs so images are served from R2.
        const processedHtml = replaceImageAttrsWithR2Urls(
          rendered.html,
          rendered.metadata?.imagePaths,
          entry.r2Key,
        );

        context.store.set({
          id: entry.id,
          data,
          body: content,
          filePath: `cloud://${entry.r2Key}`,
          rendered: { ...rendered, html: processedHtml },
          assetImports: rendered.metadata?.imagePaths,
        });
      }
    },
  };
}
