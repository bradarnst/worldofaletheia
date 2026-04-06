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

const CAMPAIGN_FAMILY_COLLECTIONS = {
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

const CAMPAIGN_FAMILY_SEGMENT_PATTERN = Object.keys(CAMPAIGN_FAMILY_COLLECTIONS).join('|');

function createContentIndexRow({
  contentEntry,
  frontmatterRecord,
  generatedAt,
}) {
  const createdAt = normalizeDateValue(frontmatterRecord.created ?? frontmatterRecord['created-date']);
  const updatedAt =
    normalizeDateValue(frontmatterRecord.modified ?? frontmatterRecord['modified-date']) ??
    createdAt ??
    contentEntry.lastModified;

  return {
    id: contentEntry.id,
    collection: contentEntry.collection,
    slug: contentEntry.slug,
    title: normalizeNullableString(frontmatterRecord.title) ?? contentEntry.slug,
    type: normalizeNullableString(frontmatterRecord.type),
    subtype: normalizeNullableString(frontmatterRecord.subtype),
    tagsJson: JSON.stringify(normalizeTags(frontmatterRecord.tags)),
    visibility: toCampaignVisibility(frontmatterRecord.visibility) ?? contentEntry.visibility,
    campaignSlug: contentEntry.campaignSlug,
    summary: normalizeNullableString(frontmatterRecord.excerpt),
    status: normalizeNullableString(frontmatterRecord.status),
    author: normalizeNullableString(frontmatterRecord.author),
    createdAt,
    updatedAt,
    r2Key: contentEntry.r2Key,
    sourceEtag: contentEntry.etag,
    sourceLastModified: contentEntry.lastModified,
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
  const r2Key = cloud.buildKey(mapping.to, normalizedRelative);
  const visibility = toCampaignVisibility(frontmatterRecord.visibility);

  const buildEntry = ({ collection, id, slug, routePath, campaignSlug }) => {
    const contentEntry = {
      collection,
      id,
      slug,
      path: routePath,
      r2Key,
      etag: sourceEtag,
      lastModified,
      visibility,
      campaignSlug,
    };

    return {
      contentEntry,
      contentIndexRow: createContentIndexRow({
        contentEntry,
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

    const familyMatch = new RegExp(`^([^/]+)\/(${CAMPAIGN_FAMILY_SEGMENT_PATTERN})\/(.+)\.md$`, 'i').exec(normalizedRelative);
    if (familyMatch) {
      const campaignSlug = familyMatch[1];
      const familySegment = familyMatch[2].toLowerCase();
      const familySlug = normalizeNullableString(frontmatterRecord.slug) ?? familyMatch[3];
      const collection = CAMPAIGN_FAMILY_COLLECTIONS[familySegment];

      return [
        buildEntry({
          collection,
          id: stripMarkdownExtension(normalizedRelative),
          slug: familySlug,
          routePath: `${mapping.to}/${normalizedRelative}`,
          campaignSlug,
        }),
      ];
    }

    const campaignMatch = /^([^/]+)\/index\.md$/i.exec(normalizedRelative);
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

export async function collectCloudContentMetadata(config, services, wikiIndex) {
  const cloud = services.cloud;
  if (!cloud) {
    return {
      generatedAt: new Date().toISOString(),
      managedCollections: [],
      contentIndexRows: [],
    };
  }

  const managedCollections = new Set();
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
        managedCollections.add(derivedEntry.contentEntry.collection);
        contentIndexRows.push(derivedEntry.contentIndexRow);
      }
    }
  }

  return {
    generatedAt,
    managedCollections: Array.from(managedCollections).sort((a, b) => a.localeCompare(b)),
    contentIndexRows,
  };
}
