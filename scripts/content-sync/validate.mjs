import fs from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_KEYS = ['title', 'type', 'status', 'author'];
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

    if (key === 'tags' && raw === '') {
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

  return { hasFrontmatter: true, malformed: false, data, body };
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
      };
    }

    return {
      root: path.resolve(config.vaultRoot, mapping.from),
      labelRoot: config.vaultRoot,
      labelPrefix: 'vault/',
    };
  });
}

export async function validateContentTree(config) {
  const roots = determineValidationRoots(config);
  const fileEntries = [];

  for (const root of roots) {
    const files = await gatherMarkdownFiles(root.root);
    for (const file of files) {
      fileEntries.push({ ...root, file });
    }
  }

  const failures = [];
  const warnings = [];

  for (const fileEntry of fileEntries) {
    const relPath = `${fileEntry.labelPrefix}${path.relative(fileEntry.labelRoot, fileEntry.file).split(path.sep).join('/')}`;
    const text = await fs.readFile(fileEntry.file, 'utf8');
    const parsed = parseFrontmatter(text);

    if (!parsed.hasFrontmatter) {
      failures.push(`${relPath} missing frontmatter block`);
      continue;
    }

    if (parsed.malformed) {
      failures.push(`${relPath} malformed frontmatter delimiters`);
      continue;
    }

    for (const key of REQUIRED_KEYS) {
      if (!Object.hasOwn(parsed.data, key)) {
        failures.push(`${relPath} missing required key ${key}`);
      }
    }

    if (Object.hasOwn(parsed.data, 'status') && !ALLOWED_STATUS.includes(parsed.data.status.replace(/['"]/g, ''))) {
      failures.push(`${relPath} invalid status value ${parsed.data.status}`);
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
  }

  return {
    ok: failures.length === 0,
    checkedFiles: fileEntries.length,
    failures,
    warnings,
  };
}
