import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizePathForDisplay } from './utils.mjs';
import { transformObsidianLinks } from './obsidian-links.mjs';
import {
  getIncludedPublicationsForSyncLane,
  resolvePublicationFromFrontmatter,
  resolvePublicationSyncLane,
} from './publication-policy.mjs';

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root, includeExtensions) {
  const out = [];
  if (!(await pathExists(root))) {
    return out;
  }

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (includeExtensions.includes(ext)) {
        out.push(absolute);
      }
    }
  }

  await walk(root);
  return out;
}

async function filesAreEqual(sourcePath, destPath) {
  const [src, dst] = await Promise.all([fs.readFile(sourcePath), fs.readFile(destPath)]);
  return src.equals(dst);
}

async function fileMd5Hex(filePath) {
  const data = await fs.readFile(filePath);
  return createHash('md5').update(data).digest('hex');
}

async function parseFrontmatterRecord(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return {};
  }

  const record = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '---') {
      break;
    }

    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (match) {
      record[match[1]] = match[2];
    }
  }

  return record;
}

function extractMarkdownMediaRefs(markdownText, markdownRelativePath) {
  const refs = new Set();
  const baseDir = path.posix.dirname(markdownRelativePath.split(path.sep).join('/'));
  const addRef = (rawTarget) => {
    const target = String(rawTarget || '').split(/[?#|]/)[0].trim();
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) {
      return;
    }

    const normalized = normalizePathForDisplay(path.posix.normalize(path.posix.join(baseDir, target)));
    refs.add(normalized);
  };

  for (const match of markdownText.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    addRef(match[1]);
  }

  for (const match of markdownText.matchAll(/!\[\[([^\]]+)\]\]/g)) {
    addRef(match[1]);
  }

  return refs;
}

async function filterSourceFilesForPublication(sourceFiles, sourceRoot) {
  const lane = resolvePublicationSyncLane(process.env);
  const includedPublications = getIncludedPublicationsForSyncLane(lane);
  if (lane !== 'production') {
    return { files: sourceFiles, excluded: [] };
  }

  const markdownFiles = sourceFiles.filter((file) => path.extname(file).toLowerCase() === '.md');
  const mediaFiles = sourceFiles.filter((file) => path.extname(file).toLowerCase() !== '.md');
  const includedMediaRefs = new Set();
  const excludedMediaRefs = new Set();
  const includedMarkdown = [];
  const excluded = [];

  for (const file of markdownFiles) {
    const relativePath = normalizePathForDisplay(path.relative(sourceRoot, file));
    const text = await fs.readFile(file, 'utf8');
    const frontmatter = await parseFrontmatterRecord(file);
    const includeFile = includedPublications.includes(resolvePublicationFromFrontmatter(frontmatter));
    const mediaRefs = extractMarkdownMediaRefs(text, relativePath);

    if (includeFile) {
      includedMarkdown.push(file);
      for (const ref of mediaRefs) {
        includedMediaRefs.add(ref);
      }
    } else {
      excluded.push(file);
      for (const ref of mediaRefs) {
        excludedMediaRefs.add(ref);
      }
    }
  }

  const includedMedia = mediaFiles.filter((file) => {
    const relativePath = normalizePathForDisplay(path.relative(sourceRoot, file));
    return !excludedMediaRefs.has(relativePath) || includedMediaRefs.has(relativePath);
  });

  return { files: [...includedMarkdown, ...includedMedia], excluded };
}

function isPlainMd5Hash(value) {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value);
}

/**
 * Build a lookup key for the previous etag map, matching the content_index id format.
 * The id is the normalized relative path without its .md extension.
 */
function buildContentIdKey(collection, relativePath) {
  return `${collection}:${relativePath.replace(/\.md$/i, '')}`;
}

function buildRemoteKey(prefix, relativePath) {
  const trimmedPrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : '';
  const trimmedRelative = relativePath.replace(/^\/+/, '');
  if (!trimmedPrefix) {
    return trimmedRelative;
  }
  return trimmedRelative ? `${trimmedPrefix}/${trimmedRelative}` : trimmedPrefix;
}

function getCloudTargetPrefix(mapping) {
  return mapping.cloudTo || mapping.to;
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

function getContentIndexCollectionForPath(mapping, relativePath) {
  if (mapping.collection) {
    return mapping.collection;
  }

  if (mapping.to !== 'campaigns') {
    return mapping.to;
  }

  const familyMatch = new RegExp(`^[^/]+\/(${CAMPAIGN_FAMILY_SEGMENT_PATTERN})\/.+\.md$`, 'i').exec(relativePath);
  if (familyMatch) {
    return CAMPAIGN_FAMILY_COLLECTIONS[familyMatch[1].toLowerCase()];
  }

  return 'campaigns';
}

function getPreviousEtag(previousEtags, mapping, relativePath) {
  if (!previousEtags) {
    return null;
  }

  return previousEtags.get(buildContentIdKey(getContentIndexCollectionForPath(mapping, relativePath), relativePath)) ?? null;
}

function resolveVirtualDestForMapping(config, mapping, relativePath) {
  const cleanupRoot = mapping.localCleanupPath
    ? path.resolve(config.repoRoot, mapping.localCleanupPath)
    : path.resolve(config.repoRoot, 'src/content', mapping.to);
  return path.resolve(cleanupRoot, relativePath);
}

/**
 * Compute the source_etag for a vault file — MD5 of the Obsidian-link-transformed content,
 * matching how cloud-content-metadata.mjs derives it during sync.
 */
async function computeSourceEtag(sourceAbs, mapping, relativePath, config, wikiIndex) {
  const sourceText = await fs.readFile(sourceAbs, 'utf8');
  const destAbs = resolveVirtualDestForMapping(config, mapping, relativePath);
  const transformed = transformObsidianLinks(sourceText, {
    destAbs,
    repoRoot: config.repoRoot,
    wikiIndex,
  });
  return createHash('md5').update(transformed).digest('hex');
}

export async function buildSyncDiff(config, services = {}, { previousEtags = null, wikiIndex = null } = {}) {
  const records = [];
  const excludedByPublication = [];

  for (const mapping of config.mappings) {
    const sourceRoot = path.resolve(config.vaultRoot, mapping.from);
    const unfilteredSourceFiles = await walkFiles(sourceRoot, config.includeExtensions);
    const publicationFiltered = mapping.target === 'cloud'
      ? await filterSourceFilesForPublication(unfilteredSourceFiles, sourceRoot)
      : { files: unfilteredSourceFiles, excluded: [] };
    const sourceFiles = mapping.to === 'campaigns'
      ? publicationFiltered.files.filter((file) => {
          const relativePath = normalizePathForDisplay(path.relative(sourceRoot, file));
          return !/^[^/]+\/sessions\/[^/]+\.md$/i.test(relativePath);
        })
      : publicationFiltered.files;
    excludedByPublication.push(...publicationFiltered.excluded.map((file) => ({
      type: 'excluded',
      relativePath: normalizePathForDisplay(path.relative(sourceRoot, file)),
      sourceAbs: file,
      destAbs: null,
      cloudKey: null,
      mapping,
      excludedReason: 'publication',
    })));

    if (mapping.target === 'repo') {
      const destRoot = path.resolve(config.repoRoot, mapping.to);
      const destFiles = await walkFiles(destRoot, config.includeExtensions);
      const sourceRel = new Map(
        sourceFiles.map((abs) => [normalizePathForDisplay(path.relative(sourceRoot, abs)), abs]),
      );
      const destRel = new Map(
        destFiles.map((abs) => [normalizePathForDisplay(path.relative(destRoot, abs)), abs]),
      );
      const allRel = new Set([...sourceRel.keys(), ...destRel.keys()]);
      for (const rel of allRel) {
        const sourceAbs = sourceRel.get(rel) || null;
        const destAbs = destRel.get(rel) || null;

        if (sourceAbs && !destAbs) {
          records.push({
            type: 'new',
            relativePath: rel,
            sourceAbs,
            destAbs: path.resolve(destRoot, rel),
            mapping,
          });
          continue;
        }

        if (sourceAbs && destAbs) {
          const equal = await filesAreEqual(sourceAbs, destAbs);
          records.push({
            type: equal ? 'unchanged' : 'updated',
            relativePath: rel,
            sourceAbs,
            destAbs,
            mapping,
          });
          continue;
        }

        if (!sourceAbs && destAbs) {
          records.push({
            type: 'stale',
            relativePath: rel,
            sourceAbs: null,
            destAbs,
            mapping,
          });
        }
      }
      continue;
    }

    const cloud = services.cloud;
    if (!cloud) {
      throw new Error('Cloud mappings require content cloud configuration.');
    }

    const remoteObjects = await cloud.listObjects(getCloudTargetPrefix(mapping), config.includeExtensions);
    const sourceRel = new Map(
      sourceFiles.map((abs) => [normalizePathForDisplay(path.relative(sourceRoot, abs)), abs]),
    );
    const remoteRel = new Map(remoteObjects);
    const allRel = new Set([...sourceRel.keys(), ...remoteRel.keys()]);

    for (const rel of allRel) {
      const sourceAbs = sourceRel.get(rel) || null;
      const remoteMeta = remoteRel.get(rel) || null;
      const cloudKey = buildRemoteKey(getCloudTargetPrefix(mapping), rel);

      if (sourceAbs && !remoteMeta) {
        records.push({
          type: 'new',
          relativePath: rel,
          sourceAbs,
          destAbs: null,
          cloudKey,
          mapping,
        });
        continue;
      }

      if (sourceAbs && remoteMeta) {
        const remoteHash = remoteMeta.etag;
        let equal = false;

        // Primary check: compare transformed vault content MD5 against the previously
        // stored D1 source_etag. Using transformed content (with Obsidian links rewritten)
        // matches how cloud-content-metadata.mjs computes the etag, so the comparison
        // is stable and avoids false positives from comparing raw vs transformed content.
        if (previousEtags) {
          const previousEtag = getPreviousEtag(previousEtags, mapping, rel);
          if (previousEtag) {
            const transformedMd5 = await computeSourceEtag(sourceAbs, mapping, rel, config, wikiIndex);
            equal = transformedMd5 === previousEtag;
          }
        }

        // Fallback to R2 ETag comparison only when no D1 record exists (new content).
        if (!equal && !getPreviousEtag(previousEtags, mapping, rel)) {
          if (isPlainMd5Hash(remoteHash)) {
            const localHash = await fileMd5Hex(sourceAbs);
            equal = localHash === remoteHash;
          } else if (typeof remoteMeta.size === 'number') {
            const sourceStat = await fs.stat(sourceAbs);
            equal = sourceStat.size === remoteMeta.size;
          }
        }

        records.push({
          type: equal ? 'unchanged' : 'updated',
          relativePath: rel,
          sourceAbs,
          destAbs: null,
          cloudKey,
          mapping,
        });
        continue;
      }

      if (!sourceAbs && remoteMeta) {
        records.push({
          type: 'stale',
          relativePath: rel,
          sourceAbs: null,
          destAbs: null,
          cloudKey,
          mapping,
        });
      }
    }

    if (mapping.localCleanupPath) {
      const cleanupRoot = path.resolve(config.repoRoot, mapping.localCleanupPath);
      const cleanupFiles = await walkFiles(cleanupRoot, config.includeExtensions);
      for (const cleanupAbs of cleanupFiles) {
        records.push({
          type: 'stale',
          relativePath: normalizePathForDisplay(path.relative(cleanupRoot, cleanupAbs)),
          sourceAbs: null,
          destAbs: cleanupAbs,
          cloudKey: null,
          mapping,
          staleReason: 'localCleanup',
        });
      }
    }
  }

  const grouped = {
    new: records.filter((r) => r.type === 'new'),
    updated: records.filter((r) => r.type === 'updated'),
    unchanged: records.filter((r) => r.type === 'unchanged'),
    stale: records.filter((r) => r.type === 'stale'),
    excludedByPublication,
  };

  return {
    records,
    grouped,
    counts: {
      new: grouped.new.length,
      updated: grouped.updated.length,
      unchanged: grouped.unchanged.length,
      stale: grouped.stale.length,
      excludedByPublication: grouped.excludedByPublication.length,
    },
  };
}
