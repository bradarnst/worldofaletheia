import fs from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_KEYS = ['title', 'type', 'status', 'author', 'secret'];
const ALLOWED_STATUS = ['draft', 'publish', 'published', 'archive', 'archived'];

function parseFrontmatter(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    return { hasFrontmatter: false, data: {} };
  }

  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { hasFrontmatter: false, data: {} };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { hasFrontmatter: true, malformed: true, data: {} };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const data = {};

  for (const line of frontmatterLines) {
    const idx = line.indexOf(':');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    data[key] = raw;
  }

  return { hasFrontmatter: true, malformed: false, data };
}

function isBooleanLike(value) {
  return value === 'true' || value === 'false';
}

function isArrayLikeYaml(value) {
  return value.startsWith('[') && value.endsWith(']');
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

export async function validateContentTree(config) {
  const mappedRoots = config.mappings
    .filter((m) => m.to.startsWith('src/content/'))
    .map((m) => path.resolve(config.repoRoot, m.to));
  const fileSet = new Set();

  for (const root of mappedRoots) {
    const files = await gatherMarkdownFiles(root);
    for (const file of files) {
      fileSet.add(file);
    }
  }

  const failures = [];
  const warnings = [];

  for (const filePath of fileSet) {
    const relPath = path.relative(config.repoRoot, filePath).split(path.sep).join('/');
    const text = await fs.readFile(filePath, 'utf8');
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

    if (Object.hasOwn(parsed.data, 'secret') && !isBooleanLike(parsed.data.secret)) {
      failures.push(`${relPath} invalid secret value (expected true/false)`);
    }

    if (Object.hasOwn(parsed.data, 'status') && !ALLOWED_STATUS.includes(parsed.data.status.replace(/['"]/g, ''))) {
      failures.push(`${relPath} invalid status value ${parsed.data.status}`);
    }

    if (Object.hasOwn(parsed.data, 'tags') && !isArrayLikeYaml(parsed.data.tags)) {
      failures.push(`${relPath} invalid tags format (expected array like [a, b])`);
    }

    if (text.includes('[[ ]]')) {
      failures.push(`${relPath} has empty wiki link [[ ]]`);
    }

    for (const headingIssue of checkHeadings(text)) {
      warnings.push(`${relPath} ${headingIssue}`);
    }

    const longLine = text.split(/\r?\n/).findIndex((line) => line.length > 220);
    if (longLine >= 0) {
      warnings.push(`${relPath} long line at ${longLine + 1} (>220 chars)`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    checkedFiles: fileSet.size,
  };
}
