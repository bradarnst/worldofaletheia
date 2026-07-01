import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/internal-helpers/frontmatter';
import { transformObsidianLinks } from './obsidian-links.mjs';
import { normalizeObsidianTags } from './validate.mjs';
import {
  getIncludedPublicationsForSyncLane,
  resolvePublicationFromFrontmatter,
  resolvePublicationSyncLane,
} from './publication-policy.mjs';

const MAX_CONTENT_SEARCH_BODY_LENGTH = 32000;

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

// Strict RFC 3339 date-time validator. Accepts either UTC `Z` or explicit
// numeric offset. Returns the ISO 8601 string, or null when the input is
// missing/empty. Throws on invalid inputs that fail strict parsing so the
// sync pipeline fails hard instead of silently coercing malformed dates.
const RFC3339_OFFSET_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

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

  if (!RFC3339_OFFSET_PATTERN.test(trimmed)) {
    throw new Error(
      `Expected strict RFC 3339 date-time with offset, received: ${trimmed}`,
    );
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse RFC 3339 date-time: ${trimmed}`);
  }

  return parsed.toISOString();
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

function normalizeAuthors(frontmatterAuthors) {
  if (Array.isArray(frontmatterAuthors)) {
    return frontmatterAuthors
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  }

  if (typeof frontmatterAuthors === 'string') {
    const trimmed = frontmatterAuthors.trim();
    if (!trimmed) {
      return [];
    }

    return trimmed
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
}

function normalizeStringList(value) {
  return normalizeAuthors(value);
}

function normalizeAudienceWarnings(value) {
  return normalizeStringList(value).filter((warning) => warning === 'gmSpoilers');
}

function getFirstNameAlias(value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  const firstToken = normalized.split(/\s+/)[0]?.trim();
  return firstToken && firstToken !== normalized ? firstToken : null;
}

function collectContributorAliases(frontmatterRecord, canonicalId) {
  return [...new Set([
    ...normalizeStringList(frontmatterRecord.aliases),
    getFirstNameAlias(frontmatterRecord.displayName),
    getFirstNameAlias(frontmatterRecord.title),
  ].filter((alias) => alias && alias !== canonicalId))];
}

function normalizeRole(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeContributorRoleEntries(frontmatterContributors) {
  if (!Array.isArray(frontmatterContributors)) {
    return [];
  }

  return frontmatterContributors.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const contributorId = normalizeNullableString(entry.id);
    if (!contributorId || !Array.isArray(entry.roles)) {
      return [];
    }

    return entry.roles
      .map(normalizeRole)
      .filter((role) => role !== null)
      .map((role) => ({ contributorId, role }));
  });
}

function createAttributionRows({ contentEntry, frontmatterRecord, generatedAt }) {
  if (contentEntry.collection === 'contributors') {
    return [];
  }

  const attributionMap = new Map();
  const addAttribution = (contributorId, role) => {
    const key = `${contributorId}\u0000${contentEntry.collection}\u0000${contentEntry.id}\u0000${role}`;
    attributionMap.set(key, {
      contributorId,
      targetType: 'content',
      targetCollection: contentEntry.collection,
      targetId: contentEntry.id,
      role,
      indexedAt: generatedAt,
    });
  };

  for (const authorId of normalizeAuthors(frontmatterRecord.authors ?? frontmatterRecord.author)) {
    addAttribution(authorId, 'author');
  }

  for (const attribution of normalizeContributorRoleEntries(frontmatterRecord.contributors)) {
    addAttribution(attribution.contributorId, attribution.role);
  }

  return [...attributionMap.values()].sort(
    (left, right) =>
      left.contributorId.localeCompare(right.contributorId) ||
      left.targetCollection.localeCompare(right.targetCollection) ||
      left.targetId.localeCompare(right.targetId) ||
      left.role.localeCompare(right.role),
  );
}

function createContributorRegistryRow({ contentEntry, frontmatterRecord, generatedAt }) {
  if (contentEntry.collection !== 'contributors') {
    return null;
  }

  const profileMode = normalizeNullableString(frontmatterRecord.profileMode);
  if (!profileMode) {
    throw new Error(`${contentEntry.id} missing required contributor profileMode.`);
  }

  return {
    id: contentEntry.id,
    aliases: collectContributorAliases(frontmatterRecord, contentEntry.id),
    displayName: normalizeNullableString(frontmatterRecord.displayName) ?? normalizeNullableString(frontmatterRecord.title) ?? contentEntry.id,
    title: normalizeNullableString(frontmatterRecord.title),
    status: normalizeNullableString(frontmatterRecord.status) ?? 'draft',
    profileMode,
    bioExcerpt: normalizeNullableString(frontmatterRecord.bioExcerpt),
    avatar: normalizeNullableString(frontmatterRecord.avatar),
    sourceId: contentEntry.id,
    r2Key: contentEntry.r2Key,
    indexedAt: generatedAt,
  };
}

function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/!\[\[([^\]]+)\]\]/g, ' $1 ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, ' $2 ')
    .replace(/\[\[([^\]]+)\]\]/g, ' $1 ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~#-]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateSearchText(value, maxLength = MAX_CONTENT_SEARCH_BODY_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trimEnd();
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

function requireFrontmatterCollection(frontmatterRecord, contextLabel) {
  const collection = normalizeNullableString(frontmatterRecord.collection);
  if (!collection) {
    throw new Error(`${contextLabel} missing required frontmatter collection.`);
  }

  return collection;
}

function assertCollectionMatch(frontmatterCollection, expectedCollection, contextLabel) {
  if (frontmatterCollection !== expectedCollection) {
    throw new Error(
      `${contextLabel} frontmatter collection "${frontmatterCollection}" does not match sync mapping/folder collection "${expectedCollection}".`,
    );
  }
}

function createContentIndexRow({
  contentEntry,
  frontmatterRecord,
  generatedAt,
}) {
  const authors = normalizeAuthors(frontmatterRecord.authors ?? frontmatterRecord.author);
  const publication = resolvePublicationFromFrontmatter(frontmatterRecord);
  // Strict RFC 3339 required. Legacy timestamp keys are no longer accepted.
  // Missing or invalid timestamps fail hard.
  const createdAt = normalizeDateValue(frontmatterRecord.createdAt);
  const updatedAt = normalizeDateValue(frontmatterRecord.updatedAt);
  if (!createdAt) {
    throw new Error(
      `${contentEntry.id} missing required RFC 3339 frontmatter field 'createdAt'.`,
    );
  }
  if (!updatedAt) {
    throw new Error(
      `${contentEntry.id} missing required RFC 3339 frontmatter field 'updatedAt'.`,
    );
  }

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
    publication,
    contentState: normalizeNullableString(frontmatterRecord.contentState) ?? 'stable',
    audienceWarningsJson: JSON.stringify(normalizeAudienceWarnings(frontmatterRecord.audienceWarnings)),
    status: normalizeNullableString(frontmatterRecord.status),
    author: authors.length > 0 ? authors.join(', ') : null,
    createdAt,
    updatedAt,
    r2Key: contentEntry.r2Key,
    sourceEtag: contentEntry.etag,
    sourceLastModified: contentEntry.lastModified,
    indexedAt: generatedAt,
  };
}

function getCloudTargetPrefix(mapping) {
  return mapping.cloudTo || mapping.to;
}

function createContentSearchRow({
  contentEntry,
  frontmatterRecord,
  bodyText,
}) {
  return {
    collection: contentEntry.collection,
    id: contentEntry.id,
    slug: contentEntry.slug,
    title: normalizeNullableString(frontmatterRecord.title) ?? contentEntry.slug,
    summary: normalizeNullableString(frontmatterRecord.excerpt),
    type: normalizeNullableString(frontmatterRecord.type),
    subtype: normalizeNullableString(frontmatterRecord.subtype),
    tagsText: normalizeTags(frontmatterRecord.tags).join(' '),
    bodyText: truncateSearchText(normalizeSearchText(bodyText)),
  };
}

export async function deriveCollectionEntries(mapping, relativePath, transformedMarkdown, sourceStats, cloud, generatedAt) {
  const normalizedRelative = normalizeDisplayPath(relativePath);
  if (!normalizedRelative.toLowerCase().endsWith('.md')) {
    return [];
  }

  const { frontmatter } = parseFrontmatter(transformedMarkdown);
  const frontmatterRecord = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const frontmatterCollection = requireFrontmatterCollection(frontmatterRecord, normalizedRelative);
  const bodyText = transformedMarkdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const sourceEtag = buildSourceEtag(transformedMarkdown);
  const lastModified = sourceStats.mtime.toISOString();
  const r2Key = cloud.buildKey(getCloudTargetPrefix(mapping), normalizedRelative);
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
      contentSearchRow: createContentSearchRow({
        contentEntry,
        frontmatterRecord,
        bodyText,
      }),
      contributorRegistryRow: createContributorRegistryRow({
        contentEntry,
        frontmatterRecord,
        generatedAt,
      }),
      attributionRows: createAttributionRows({
        contentEntry,
        frontmatterRecord,
        generatedAt,
      }),
    };
  };

  if (mapping.to === 'campaigns') {
    if (/^[^/]+\/sessions\/[^/]+\.md$/i.test(normalizedRelative)) {
      return [];
    }

    const familyMatch = new RegExp(`^([^/]+)\/(${CAMPAIGN_FAMILY_SEGMENT_PATTERN})\/(.+)\.md$`, 'i').exec(normalizedRelative);
    if (familyMatch) {
      const campaignSlug = familyMatch[1];
      const familySegment = familyMatch[2].toLowerCase();
      const familySlug = normalizeNullableString(frontmatterRecord.slug) ?? familyMatch[3];
      const collection = CAMPAIGN_FAMILY_COLLECTIONS[familySegment];
      assertCollectionMatch(frontmatterCollection, collection, normalizedRelative);

      return [
        buildEntry({
          collection: frontmatterCollection,
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
      assertCollectionMatch(frontmatterCollection, 'campaigns', normalizedRelative);
      return [
        buildEntry({
          collection: frontmatterCollection,
          id: stripMarkdownExtension(normalizedRelative),
          slug: normalizeNullableString(frontmatterRecord.slug) ?? campaignSlug,
          routePath: `${mapping.to}/${normalizedRelative}`,
          campaignSlug,
        }),
      ];
    }

    const legacyCampaignMatch = /^([^/]+)\/([^/]+)\.md$/i.exec(normalizedRelative);
    if (legacyCampaignMatch) {
      const campaignSlug = legacyCampaignMatch[1];
      const topLevelFileName = legacyCampaignMatch[2].toLowerCase();
      if (
        topLevelFileName !== 'index' &&
        topLevelFileName !== 'sessions' &&
        !Object.prototype.hasOwnProperty.call(CAMPAIGN_FAMILY_COLLECTIONS, topLevelFileName)
      ) {
        assertCollectionMatch(frontmatterCollection, 'campaigns', normalizedRelative);
        return [
          buildEntry({
            collection: frontmatterCollection,
            id: stripMarkdownExtension(normalizedRelative),
            slug: normalizeNullableString(frontmatterRecord.slug) ?? campaignSlug,
            routePath: `${mapping.to}/${normalizedRelative}`,
            campaignSlug,
          }),
        ];
      }
    }

    return [];
  }

  const collection = frontmatterCollection;
  const expectedCollection = mapping.collection || mapping.to;
  assertCollectionMatch(collection, expectedCollection, normalizedRelative);
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
      contentSearchRows: [],
      contributorRows: [],
      attributionRows: [],
    };
  }

  const managedCollections = new Set();
  const contentIndexRows = [];
  const contentSearchRows = [];
  const contributorRows = [];
  const attributionRows = [];
  const generatedAt = new Date().toISOString();
  const syncLane = resolvePublicationSyncLane(process.env);
  const includedPublications = getIncludedPublicationsForSyncLane(syncLane);

  for (const mapping of config.mappings.filter((candidate) => candidate.target === 'cloud')) {
    if (mapping.to === 'campaigns') {
      managedCollections.add('sessions');
    }

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
        if (!includedPublications.includes(derivedEntry.contentIndexRow.publication)) {
          continue;
        }
        contentIndexRows.push(derivedEntry.contentIndexRow);
        contentSearchRows.push(derivedEntry.contentSearchRow);
        if (derivedEntry.contributorRegistryRow) {
          contributorRows.push(derivedEntry.contributorRegistryRow);
        }
        attributionRows.push(...derivedEntry.attributionRows);
      }
    }
  }

  const contributorAliasMap = new Map();
  for (const row of contributorRows) {
    for (const alias of [row.id, ...(row.aliases ?? [])]) {
      const existingContributorId = contributorAliasMap.get(alias);
      if (existingContributorId && existingContributorId !== row.id) {
        throw new Error(`Contributor alias "${alias}" is claimed by both "${existingContributorId}" and "${row.id}".`);
      }

      contributorAliasMap.set(alias, row.id);
    }
  }

  const canonicalAttributionRows = attributionRows.map((row) => ({
    ...row,
    contributorId: contributorAliasMap.get(row.contributorId) ?? row.contributorId,
  }));

  return {
    generatedAt,
    managedCollections: Array.from(managedCollections).sort((a, b) => a.localeCompare(b)),
    contentIndexRows,
    contentSearchRows,
    contributorRows,
    attributionRows: canonicalAttributionRows,
  };
}
