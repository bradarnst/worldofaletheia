import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformObsidianLinks } from './obsidian-links.mjs';
import { normalizeObsidianTags } from './validate.mjs';

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

function buildManifestKey(prefix, collection) {
  const trimmedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  return trimmedPrefix ? `${trimmedPrefix}/manifests/${collection}.json` : `manifests/${collection}.json`;
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

function normalizeTags(frontmatterTags) {
  const normalized = normalizeObsidianTags({
    frontmatterTags,
    inlineTags: [],
  });

  if (!normalized.ok) {
    return [];
  }

  return normalized.tags;
}

function buildSourceEtag(text) {
  return createHash('md5').update(text).digest('hex');
}

function toCampaignVisibility(value) {
  return value === 'public' || value === 'campaignMembers' || value === 'gm' ? value : null;
}

function createContentIndexRow({
  manifestEntry,
  frontmatterRecord,
  generatedAt,
}) {
  const createdAt = normalizeDateValue(frontmatterRecord.created ?? frontmatterRecord['created-date']);
  const updatedAt =
    normalizeDateValue(frontmatterRecord.modified ?? frontmatterRecord['modified-date']) ??
    createdAt ??
    manifestEntry.lastModified;

  return {
    id: manifestEntry.id,
    collection: manifestEntry.collection,
    slug: manifestEntry.slug,
    title: normalizeNullableString(frontmatterRecord.title) ?? manifestEntry.slug,
    type: normalizeNullableString(frontmatterRecord.type),
    subtype: normalizeNullableString(frontmatterRecord.subtype),
    tagsJson: JSON.stringify(normalizeTags(frontmatterRecord.tags)),
    visibility: toCampaignVisibility(frontmatterRecord.visibility) ?? manifestEntry.visibility,
    campaignSlug: manifestEntry.campaignSlug,
    summary: normalizeNullableString(frontmatterRecord.excerpt),
    status: normalizeNullableString(frontmatterRecord.status),
    author: normalizeNullableString(frontmatterRecord.author),
    createdAt,
    updatedAt,
    sourceEtag: manifestEntry.etag,
    sourceLastModified: manifestEntry.lastModified,
    indexedAt: generatedAt,
  };
}

async function deriveCollectionEntries(mapping, relativePath, transformedMarkdown, sourceStats, cloud, generatedAt) {
  const parseFrontmatter = await getParseFrontmatter();
  const normalizedRelative = normalizeDisplayPath(relativePath);
  if (!normalizedRelative.toLowerCase().endsWith('.md')) {
    return [];
  }

  const { frontmatter } = parseFrontmatter(transformedMarkdown);
  const frontmatterRecord = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const sourceEtag = buildSourceEtag(transformedMarkdown);
  const lastModified = sourceStats.mtime.toISOString();
  const cloudKey = cloud.buildKey(mapping.to, normalizedRelative);
  const visibility = toCampaignVisibility(frontmatterRecord.visibility);

  const buildEntry = ({ collection, id, slug, routePath, campaignSlug }) => {
    const manifestEntry = {
      collection,
      id,
      slug,
      path: routePath,
      key: cloudKey,
      etag: sourceEtag,
      lastModified,
      visibility,
      campaignSlug,
    };

    return {
      manifestEntry,
      contentIndexRow: createContentIndexRow({
        manifestEntry,
        frontmatterRecord,
        generatedAt,
      }),
    };
  };

  if (mapping.to === 'campaigns') {
    const sessionMatch = /^([^/]+)\/sessions\/([^/]+)\.md$/i.exec(normalizedRelative);
    if (sessionMatch) {
      const campaignSlug = sessionMatch[1];
      const sessionSlug = normalizeNullableString(frontmatterRecord.slug) ?? sessionMatch[2];
      return [
        buildEntry({
          collection: 'sessions',
          id: stripMarkdownExtension(normalizedRelative),
          slug: sessionSlug,
          routePath: `${mapping.to}/${normalizedRelative}`,
          campaignSlug,
        }),
      ];
    }

    const campaignMatch = /^([^/]+)\/([^/]+)\.md$/i.exec(normalizedRelative);
    if (campaignMatch) {
      const campaignSlug = campaignMatch[1];
      return [
        buildEntry({
          collection: 'campaigns',
          id: stripMarkdownExtension(normalizedRelative),
          slug: normalizeNullableString(frontmatterRecord.slug) ?? campaignSlug,
          routePath: `${mapping.to}/${normalizedRelative}`,
          campaignSlug,
        }),
      ];
    }

    return [];
  }

  const collection = mapping.collection || mapping.to;
  const id = stripMarkdownExtension(normalizedRelative);

  return [
    buildEntry({
      collection,
      id,
      slug: normalizeNullableString(frontmatterRecord.slug) ?? id,
      routePath: `${mapping.to}/${normalizedRelative}`,
      campaignSlug: normalizeNullableString(frontmatterRecord.campaign),
    }),
  ];
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
    return {
      writtenKeys: [],
      generatedAt: new Date().toISOString(),
      managedCollections: [],
      contentIndexRows: [],
    };
  }

  const manifestEntriesByCollection = new Map();
  const contentIndexRows = [];
  const generatedAt = new Date().toISOString();

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
      const sourceStats = await fsp.stat(absolutePath);

      for (const derivedEntry of await deriveCollectionEntries(
        mapping,
        relativePath,
        transformedMarkdown,
        sourceStats,
        cloud,
        generatedAt,
      )) {
        const collectionEntries = manifestEntriesByCollection.get(derivedEntry.manifestEntry.collection) ?? [];
        collectionEntries.push(derivedEntry.manifestEntry);
        manifestEntriesByCollection.set(derivedEntry.manifestEntry.collection, collectionEntries);
        contentIndexRows.push(derivedEntry.contentIndexRow);
      }
    }
  }

  const writtenKeys = [];
  const manifestPrefix = config.contentCloud?.prefix || 'content';

  try {
    for (const [collection, entries] of manifestEntriesByCollection.entries()) {
      entries.sort((a, b) => a.id.localeCompare(b.id));
      const manifest = {
        version: 1,
        collection,
        generatedAt,
        entries,
      };
      const key = buildManifestKey(manifestPrefix, collection);
      await cloud.uploadText(key, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json');
      writtenKeys.push(key);
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
    await cloud.uploadText(indexKey, `${JSON.stringify(indexManifest, null, 2)}\n`, 'application/json');
    writtenKeys.push(indexKey);
  } catch (uploadError) {
    console.error('Cloud manifest upload failed (D1 index will still be updated):', uploadError.message);
  }

  return {
    writtenKeys,
    generatedAt,
    managedCollections: Array.from(manifestEntriesByCollection.keys()).sort((a, b) => a.localeCompare(b)),
    contentIndexRows,
  };
}
