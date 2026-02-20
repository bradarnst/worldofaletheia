import fs from 'node:fs/promises';
import path from 'node:path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function normalizeLookupKey(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseFrontmatterTitle(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }

  const titleLine = match[1]
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith('title:'));

  if (!titleLine) {
    return null;
  }

  return titleLine
    .slice(titleLine.indexOf(':') + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '') || null;
}

function computeRouteFromMarkdownPath(absolutePath, repoRoot) {
  const relative = toPosix(path.relative(path.resolve(repoRoot, 'src/content'), absolutePath));
  const segments = relative.split('/');
  const collection = segments[0];
  const fileName = segments[segments.length - 1];
  const slug = fileName.replace(/\.md$/i, '');

  if (segments.length === 1) {
    return `/${slug}`;
  }

  if (collection === 'campaigns') {
    const campaignFolder = segments[1];
    const isSessionFile = segments.length >= 4 && segments[2] === 'sessions';

    if (isSessionFile) {
      return slug === 'index'
        ? `/campaigns/${campaignFolder}/sessions`
        : `/campaigns/${campaignFolder}/sessions/${slug}`;
    }

    return slug === 'index' ? `/campaigns/${campaignFolder}` : `/campaigns/${slug}`;
  }

  return `/${collection}/${slug}`;
}

async function walkMarkdownFiles(root) {
  const files = [];

  async function walk(current) {
    let entries = [];
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

export async function buildWikiLinkIndex(repoRoot) {
  const contentRoot = path.resolve(repoRoot, 'src/content');
  const files = await walkMarkdownFiles(contentRoot);
  const keyToRoute = new Map();

  for (const absolutePath of files) {
    const markdown = await fs.readFile(absolutePath, 'utf8');
    const route = computeRouteFromMarkdownPath(absolutePath, repoRoot);
    const fileBaseName = path.basename(absolutePath, '.md');
    const frontmatterTitle = parseFrontmatterTitle(markdown);

    const keys = [fileBaseName, frontmatterTitle].filter(Boolean).map((value) => normalizeLookupKey(value));
    for (const key of keys) {
      if (!keyToRoute.has(key)) {
        keyToRoute.set(key, route);
      }
    }
  }

  return { keyToRoute };
}

function resolveWikiTarget(target, wikiIndex) {
  const [withoutAnchor] = target.split('#');
  const cleaned = withoutAnchor.trim();

  if (!cleaned) {
    return null;
  }

  if (/^(https?:\/\/|mailto:|\/)/i.test(cleaned)) {
    return cleaned;
  }

  const lookupKey = normalizeLookupKey(cleaned.replace(/\.md$/i, ''));
  return wikiIndex.keyToRoute.get(lookupKey) ?? null;
}

function toRelativeMarkdownPath(fromFile, toFile) {
  let relative = toPosix(path.relative(path.dirname(fromFile), toFile));
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative;
}

export function transformObsidianLinks(markdown, { destAbs, repoRoot, wikiIndex }) {
  const replaceWikiSyntax = (raw, isEmbed) => {
    const [targetRaw, aliasRaw] = raw.split('|').map((part) => part.trim());
    const target = targetRaw || '';
    const alias = aliasRaw || '';

    if (!target) {
      return raw;
    }

    const extension = path.extname(target).toLowerCase();
    if (isEmbed || IMAGE_EXTENSIONS.has(extension)) {
      const imageFileName = path.basename(target);
      const imageAbs = path.resolve(repoRoot, 'src/assets/images', imageFileName);
      const imagePath = toRelativeMarkdownPath(destAbs, imageAbs);
      const altText = alias || path.basename(imageFileName, extension);
      return `![${altText}](${imagePath})`;
    }

    const resolved = resolveWikiTarget(target, wikiIndex);
    if (!resolved) {
      return raw;
    }

    return `[${alias || target}](${resolved})`;
  };

  const withEmbeds = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner) => replaceWikiSyntax(inner, true));
  return withEmbeds.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => replaceWikiSyntax(inner, false));
}
