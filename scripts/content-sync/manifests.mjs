import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformObsidianLinks } from './obsidian-links.mjs';

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

function normalizeDisplayPath(value) {
  return value.split(path.sep).join('/');
}

function stripMarkdownExtension(relativePath) {
  return relativePath.replace(/\.md$/i, '');
}

async function deriveCollectionEntries(mapping, relativePath, transformedMarkdown, cloud) {
  const parseFrontmatter = await getParseFrontmatter();
  const normalizedRelative = normalizeDisplayPath(relativePath);
  if (!normalizedRelative.toLowerCase().endsWith('.md')) {
    return [];
  }

  const { frontmatter } = parseFrontmatter(transformedMarkdown);
  const frontmatterRecord = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const entries = [];
  const cloudKey = cloud.buildKey(mapping.to, normalizedRelative);

  if (mapping.to === 'campaigns') {
    const sessionMatch = /^([^/]+)\/sessions\/([^/]+)\.md$/i.exec(normalizedRelative);
    if (sessionMatch) {
      const campaignSlug = sessionMatch[1];
      const sessionSlug = String(frontmatterRecord.slug ?? sessionMatch[2]);
      entries.push({
        collection: 'sessions',
        id: stripMarkdownExtension(normalizedRelative),
        slug: sessionSlug,
        path: `${mapping.to}/${normalizedRelative}`,
        key: cloudKey,
        visibility: typeof frontmatterRecord.visibility === 'string' ? frontmatterRecord.visibility : undefined,
        campaignSlug,
      });
      return entries;
    }

    const campaignMatch = /^([^/]+)\/([^/]+)\.md$/i.exec(normalizedRelative);
    if (campaignMatch) {
      const campaignSlug = campaignMatch[1];
      entries.push({
        collection: 'campaigns',
        id: stripMarkdownExtension(normalizedRelative),
        slug: typeof frontmatterRecord.slug === 'string' ? frontmatterRecord.slug : campaignSlug,
        path: `${mapping.to}/${normalizedRelative}`,
        key: cloudKey,
        visibility: typeof frontmatterRecord.visibility === 'string' ? frontmatterRecord.visibility : undefined,
        campaignSlug,
      });
    }

    return entries;
  }

  const collection = mapping.collection || mapping.to;
  entries.push({
    collection,
    id: stripMarkdownExtension(normalizedRelative),
    slug: typeof frontmatterRecord.slug === 'string' ? frontmatterRecord.slug : stripMarkdownExtension(normalizedRelative),
    path: `${mapping.to}/${normalizedRelative}`,
    key: cloudKey,
    visibility: typeof frontmatterRecord.visibility === 'string' ? frontmatterRecord.visibility : undefined,
    campaignSlug: typeof frontmatterRecord.campaign === 'string' ? frontmatterRecord.campaign : undefined,
  });
  return entries;
}

function buildManifestKey(prefix, collection) {
  const trimmedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  return trimmedPrefix ? `${trimmedPrefix}/manifests/${collection}.json` : `manifests/${collection}.json`;
}

async function gatherSourceFiles(config, mapping) {
  const sourceRoot = path.resolve(config.vaultRoot, mapping.from);
  const files = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (config.includeExtensions.includes(ext)) {
        files.push(absolute);
      }
    }
  }

  await walk(sourceRoot);
  return { sourceRoot, files };
}

function resolveVirtualDestination(config, mapping, relativePath) {
  const cleanupRoot = mapping.localCleanupPath
    ? path.resolve(config.repoRoot, mapping.localCleanupPath)
    : path.resolve(config.repoRoot, 'src/content', mapping.to);
  return path.resolve(cleanupRoot, relativePath);
}

export async function syncCloudManifests(config, services, wikiIndex) {
  const cloud = services.cloud;
  if (!cloud) {
    return [];
  }

  const manifestEntriesByCollection = new Map();

  for (const mapping of config.mappings.filter((candidate) => candidate.target === 'cloud')) {
    const { sourceRoot, files } = await gatherSourceFiles(config, mapping);

    for (const absolutePath of files) {
      if (path.extname(absolutePath).toLowerCase() !== '.md') {
        continue;
      }

      const relativePath = normalizeDisplayPath(path.relative(sourceRoot, absolutePath));
      const sourceText = await fsp.readFile(absolutePath, 'utf8');
      const transformedMarkdown = transformObsidianLinks(sourceText, {
        destAbs: resolveVirtualDestination(config, mapping, relativePath),
        repoRoot: config.repoRoot,
        wikiIndex,
      });

      for (const entry of await deriveCollectionEntries(mapping, relativePath, transformedMarkdown, cloud)) {
        const collectionEntries = manifestEntriesByCollection.get(entry.collection) ?? [];
        collectionEntries.push(entry);
        manifestEntriesByCollection.set(entry.collection, collectionEntries);
      }
    }
  }

  const writes = [];
  const generatedAt = new Date().toISOString();
  const manifestPrefix = config.contentCloud?.prefix || 'content';

  for (const [collection, entries] of manifestEntriesByCollection.entries()) {
    entries.sort((a, b) => a.id.localeCompare(b.id));
    const manifest = {
      version: 1,
      collection,
      generatedAt,
      entries,
    };
    const key = buildManifestKey(manifestPrefix, collection);
    await cloud.uploadText(key, `${JSON.stringify(manifest, null, 2)}
`, 'application/json');
    writes.push(key);
  }

  const indexManifest = {
    version: 1,
    generatedAt,
    collections: Array.from(manifestEntriesByCollection.entries()).map(([collection, entries]) => ({
      collection,
      count: entries.length,
      key: buildManifestKey(manifestPrefix, collection),
    })),
  };
  const indexKey = buildManifestKey(manifestPrefix, '_index');
  await cloud.uploadText(indexKey, `${JSON.stringify(indexManifest, null, 2)}
`, 'application/json');
  writes.push(indexKey);

  return writes;
}
