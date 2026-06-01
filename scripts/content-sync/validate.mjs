import fs from 'node:fs/promises';
import path from 'node:path';

const ARTICLE_REQUIRED_KEYS = ['title', 'collection', 'type', 'status', 'authors'];
const COLLECTION_VALIDATION_RULES = {
  lore: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  places: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  sentients: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  bestiary: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  flora: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  factions: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  systems: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  meta: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaigns: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  sessions: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignLore: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignPlaces: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignSentients: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignBestiary: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignFlora: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignFactions: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignSystems: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignMeta: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignCharacters: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignScenes: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignAdventures: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  campaignHooks: { requiredKeys: ARTICLE_REQUIRED_KEYS },
  contributors: { requiredKeys: ['title', 'collection', 'status', 'profileMode'] },
};
const CONTRIBUTOR_PROFILE_MODES = ['standard', 'featured'];
const ALLOWED_STATUS = [
  'draft',
  'publish',
  'published',
  'archive',
  'archived',
  'planning',
  'active',
  'completed',
  'on-hold',
  'cancelled',
];

function extractInlineHashtags(text) {
  const tags = [];
  const regex = /(^|[\s([{'"`])#([A-Za-z0-9][A-Za-z0-9_\/-]*)/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.push(match[2]);
  }
  return tags;
}

function normalizeTagValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '');
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}

function dedupeAndSortTags(values) {
  return [...new Set(values.map(normalizeTagValue).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function parseBracketTagArray(raw) {
  const inner = raw.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStringListValue(value) {
  if (value == null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim().replace(/^['"]|['"]$/g, '') : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  const parsedValues = raw.startsWith('[') && raw.endsWith(']')
    ? parseBracketTagArray(raw)
    : raw.includes(',')
      ? raw.split(',')
      : [raw];

  return parsedValues
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter((item) => item.length > 0);
}

function normalizeContributorId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return trimmed ? trimmed : null;
}

function normalizeFrontmatterScalar(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return trimmed ? trimmed : null;
}

function normalizeRelativeMarkdownId(root, file) {
  return path.relative(root, file).split(path.sep).join('/').replace(/\.md$/i, '');
}

function getFirstNameAlias(value) {
  const normalized = normalizeFrontmatterScalar(value);
  if (!normalized) {
    return null;
  }

  const firstToken = normalized.split(/\s+/)[0]?.trim();
  return firstToken && firstToken !== normalized ? firstToken : null;
}

function collectContributorIdentityAliases(parsed, canonicalId) {
  return [...new Set([
    ...normalizeStringListValue(parsed.data.aliases),
    getFirstNameAlias(parsed.data.displayName),
    getFirstNameAlias(parsed.data.title),
  ].filter((alias) => alias && alias !== canonicalId))];
}

function extractContributorRoleIds(frontmatterLines = []) {
  const ids = [];
  const contributorsStart = frontmatterLines.findIndex((line) => /^contributors\s*:\s*$/.test(line));
  if (contributorsStart === -1) {
    return ids;
  }

  for (const line of frontmatterLines.slice(contributorsStart + 1)) {
    if (/^\S/.test(line)) {
      break;
    }

    const idMatch = /^\s*-\s*id\s*:\s*(.+?)\s*$/.exec(line);
    if (!idMatch) {
      continue;
    }

    const id = normalizeContributorId(idMatch[1]);
    if (id) {
      ids.push(id);
    }
  }

  return ids;
}

function collectContributorReferences(parsed) {
  const references = [];

  for (const id of normalizeStringListValue(parsed.data.authors)) {
    references.push({ id, source: 'authors' });
  }

  const legacyAuthor = normalizeContributorId(parsed.data.author);
  if (legacyAuthor) {
    for (const id of normalizeStringListValue(legacyAuthor)) {
      references.push({ id, source: 'author' });
    }
  }

  for (const id of extractContributorRoleIds(parsed.frontmatterLines)) {
    references.push({ id, source: 'contributors[].id' });
  }

  return references;
}

export function normalizeObsidianTags({ frontmatterTags, inlineTags = [] }) {
  let frontmatterValues = [];

  if (frontmatterTags == null || frontmatterTags === '') {
    frontmatterValues = [];
  } else if (Array.isArray(frontmatterTags)) {
    frontmatterValues = frontmatterTags;
  } else if (typeof frontmatterTags === 'string') {
    const raw = frontmatterTags.trim();

    if (!raw) {
      frontmatterValues = [];
    } else if (raw.startsWith('[') || raw.endsWith(']')) {
      if (!(raw.startsWith('[') && raw.endsWith(']'))) {
        return { ok: false, reason: 'mismatched bracket array' };
      }
      frontmatterValues = parseBracketTagArray(raw);
    } else if (raw.includes(',')) {
      frontmatterValues = raw.split(',').map((item) => item.trim());
    } else {
      frontmatterValues = [raw];
    }
  } else {
    return { ok: false, reason: 'unsupported tags type' };
  }

  const normalized = dedupeAndSortTags([...frontmatterValues, ...inlineTags]);
  return { ok: true, tags: normalized };
}

function parseFrontmatter(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    return { hasFrontmatter: false, data: {}, body: text };
  }

  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { hasFrontmatter: false, data: {}, body: text };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { hasFrontmatter: true, malformed: true, data: {}, body: '' };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  const data = {};

  for (let i = 0; i < frontmatterLines.length; i += 1) {
    const line = frontmatterLines[i];
    const idx = line.indexOf(':');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();

    if ((key === 'tags' || key === 'authors' || key === 'aliases') && raw === '') {
      const listItems = [];
      let cursor = i + 1;
      while (cursor < frontmatterLines.length) {
        const candidate = frontmatterLines[cursor];
        const listMatch = /^\s*-\s*(.+?)\s*$/.exec(candidate);
        if (listMatch) {
          listItems.push(listMatch[1]);
          cursor += 1;
          continue;
        }

        if (/^\s+/.test(candidate)) {
          break;
        }

        break;
      }

      if (listItems.length > 0) {
        data[key] = listItems;
        i = cursor - 1;
        continue;
      }
    }

    data[key] = raw;
  }

  return { hasFrontmatter: true, malformed: false, data, body, frontmatterLines };
}

function getValidationRuleForCollection(collection) {
  return collection ? COLLECTION_VALIDATION_RULES[collection] ?? null : null;
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

function inferCollectionFromMappingTo(mappingTo) {
  const normalized = String(mappingTo || '').trim().split('\\').join('/').replace(/\/+$/, '');
  const contentMatch = /^src\/content\/([^/]+)$/.exec(normalized);
  if (contentMatch) {
    return contentMatch[1];
  }

  return normalized.split('/').pop() || normalized;
}

function inferCampaignCollectionFromRelativePath(relativePath) {
  if (/^[^/]+\/sessions\/[^/]+\.md$/i.test(relativePath)) {
    return 'sessions';
  }

  const familyMatch = new RegExp(`^[^/]+\/(${CAMPAIGN_FAMILY_SEGMENT_PATTERN})\/.+\.md$`, 'i').exec(relativePath);
  if (familyMatch) {
    return CAMPAIGN_FAMILY_COLLECTIONS[familyMatch[1].toLowerCase()];
  }

  if (/^[^/]+\/index\.md$/i.test(relativePath)) {
    return 'campaigns';
  }

  const legacyCampaignMatch = /^[^/]+\/([^/]+)\.md$/i.exec(relativePath);
  if (legacyCampaignMatch) {
    const topLevelFileName = legacyCampaignMatch[1].toLowerCase();
    if (
      topLevelFileName !== 'index' &&
      topLevelFileName !== 'sessions' &&
      !Object.prototype.hasOwnProperty.call(CAMPAIGN_FAMILY_COLLECTIONS, topLevelFileName)
    ) {
      return 'campaigns';
    }
  }

  return 'campaigns';
}

function inferExpectedCollection(fileEntry) {
  const relativePath = path.relative(fileEntry.root, fileEntry.file).split(path.sep).join('/');
  if (fileEntry.collection === 'campaigns') {
    return inferCampaignCollectionFromRelativePath(relativePath);
  }

  return fileEntry.collection;
}

function checkHeadings(content) {
  const lines = content.split(/\r?\n/);
  let previous = 0;
  const errors = [];

  lines.forEach((line, idx) => {
    const match = /^(#{1,6})\s+/.exec(line);
    if (!match) {
      return;
    }
    const level = match[1].length;
    if (previous && level > previous + 1) {
      errors.push(`heading jump at line ${idx + 1}: H${previous} -> H${level}`);
    }
    previous = level;
  });

  return errors;
}

async function gatherMarkdownFiles(root) {
  const files = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(absolute);
      }
    }
  }

  await walk(root);
  return files;
}

function determineValidationRoots(config) {
  return config.mappings.map((mapping) => {
    if (mapping.target === 'repo' || !config.vaultRoot || !mapping.from) {
      return {
        root: path.resolve(config.repoRoot, mapping.to),
        labelRoot: config.repoRoot,
        labelPrefix: '',
        collection: mapping.collection || inferCollectionFromMappingTo(mapping.to),
      };
    }

    return {
      root: path.resolve(config.vaultRoot, mapping.from),
      labelRoot: config.vaultRoot,
      labelPrefix: 'vault/',
      collection: mapping.collection || inferCollectionFromMappingTo(mapping.to),
    };
  });
}

export async function validateContentTree(config) {
  const roots = determineValidationRoots(config);
  const fileEntries = [];
  let hasContributorCollection = roots.some((root) => root.collection === 'contributors');

  for (const root of roots) {
    const files = await gatherMarkdownFiles(root.root);
    for (const file of files) {
      fileEntries.push({ ...root, file });
    }
  }

  const failures = [];
  const warnings = [];
  const parsedEntries = [];
  const contributorIds = new Set();
  const contributorAliasOwners = new Map();

  const registerContributorIdentity = (identity, canonicalId, relPath) => {
    const existingContributorId = contributorAliasOwners.get(identity);
    if (existingContributorId && existingContributorId !== canonicalId) {
      failures.push(
        `${relPath} contributor alias "${identity}" is claimed by both "${existingContributorId}" and "${canonicalId}"`,
      );
      return;
    }

    contributorAliasOwners.set(identity, canonicalId);
    contributorIds.add(identity);
  };

  for (const fileEntry of fileEntries) {
    const relPath = `${fileEntry.labelPrefix}${path.relative(fileEntry.labelRoot, fileEntry.file).split(path.sep).join('/')}`;
    const text = await fs.readFile(fileEntry.file, 'utf8');
    const parsed = parseFrontmatter(text);
    parsedEntries.push({ fileEntry, relPath, text, parsed });

    const declaredCollection = normalizeFrontmatterScalar(parsed.data.collection);
    const expectedCollection = inferExpectedCollection(fileEntry);

    if ((declaredCollection ?? expectedCollection) === 'contributors') {
      hasContributorCollection = true;
      const canonicalId = normalizeRelativeMarkdownId(fileEntry.root, fileEntry.file);
      registerContributorIdentity(canonicalId, canonicalId, relPath);
      for (const alias of collectContributorIdentityAliases(parsed, canonicalId)) {
        registerContributorIdentity(alias, canonicalId, relPath);
      }
    }
  }

  for (const { fileEntry, relPath, text, parsed } of parsedEntries) {
    const declaredCollection = normalizeFrontmatterScalar(parsed.data.collection);
    const expectedCollection = inferExpectedCollection(fileEntry);
    const validationCollection = declaredCollection ?? expectedCollection;
    const validationRule = getValidationRuleForCollection(validationCollection);

    if (!parsed.hasFrontmatter) {
      failures.push(`${relPath} missing frontmatter block`);
      continue;
    }

    if (parsed.malformed) {
      failures.push(`${relPath} malformed frontmatter delimiters`);
      continue;
    }

    if (!validationRule) {
      failures.push(`${relPath} has unknown collection ${validationCollection ?? '<missing>'}`);
      continue;
    }

    if (declaredCollection && declaredCollection !== expectedCollection) {
      failures.push(
        `${relPath} frontmatter collection "${declaredCollection}" does not match sync mapping/folder collection "${expectedCollection}"`,
      );
    }

    const requiredKeys = validationRule.requiredKeys;

    for (const key of requiredKeys) {
      if (!Object.hasOwn(parsed.data, key)) {
        failures.push(`${relPath} missing required key ${key}`);
      }
    }

    if (declaredCollection && !getValidationRuleForCollection(declaredCollection)) {
      failures.push(`${relPath} has unknown frontmatter collection "${declaredCollection}"`);
    }

    if (requiredKeys.includes('authors')) {
      const authors = normalizeStringListValue(parsed.data.authors);
      if (authors.length === 0) {
        failures.push(`${relPath} authors must contain at least one contributor id`);
      }
    }

    if (Object.hasOwn(parsed.data, 'status') && !ALLOWED_STATUS.includes(parsed.data.status.replace(/['"]/g, ''))) {
      failures.push(`${relPath} invalid status value ${parsed.data.status}`);
    }

    if (validationCollection === 'contributors' && Object.hasOwn(parsed.data, 'profileMode')) {
      const profileMode = normalizeFrontmatterScalar(parsed.data.profileMode);
      if (!profileMode || !CONTRIBUTOR_PROFILE_MODES.includes(profileMode)) {
        failures.push(`${relPath} invalid profileMode value ${parsed.data.profileMode}`);
      }
    }

    const inlineTags = extractInlineHashtags(parsed.body || '');
    const normalizedTags = normalizeObsidianTags({
      frontmatterTags: parsed.data.tags,
      inlineTags,
    });

    if (!normalizedTags.ok) {
      failures.push(`${relPath} invalid tags format (${normalizedTags.reason})`);
    }

    if (text.includes('[[ ]]')) {
      failures.push(`${relPath} has empty wiki link [[ ]]`);
    }

    if (/!\[\[[^\]]+\]\]|\[\[[^\]]+\]\]/.test(text)) {
      warnings.push(`${relPath} contains Obsidian wiki syntax; run content sync to normalize links/embeds`);
    }

    for (const headingIssue of checkHeadings(text)) {
      warnings.push(`${relPath} ${headingIssue}`);
    }

    if (hasContributorCollection && validationCollection !== 'contributors') {
      for (const reference of collectContributorReferences(parsed)) {
        if (!contributorIds.has(reference.id)) {
          failures.push(
            `${relPath} references unknown contributor id "${reference.id}" in ${reference.source}; add a contributor profile at contributors/${reference.id}.md or fix the id`,
          );
        }
      }
    }
  }

  return {
    ok: failures.length === 0,
    checkedFiles: fileEntries.length,
    failures,
    warnings,
  };
}
