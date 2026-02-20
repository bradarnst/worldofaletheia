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

function slugifySegment(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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
  const slug = slugifySegment(fileName.replace(/\.md$/i, ''));

  if (segments.length === 1) {
    return `/${slug}`;
  }

  if (collection === 'campaigns') {
    const campaignFolder = slugifySegment(segments[1]);
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

async function walkAssetFiles(root) {
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
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          files.push(absolute);
        }
      }
    }
  }

  await walk(root);
  return files;
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
  const imageKeyToAbs = new Map();

  const imagesRoot = path.resolve(repoRoot, 'src/assets/images');
  const imageFiles = await walkAssetFiles(imagesRoot);
  for (const imageAbs of imageFiles) {
    const baseName = path.basename(imageAbs, path.extname(imageAbs));
    const relFromImagesRoot = toPosix(path.relative(imagesRoot, imageAbs)).replace(/\.[^.]+$/, '');
    const keys = [baseName, relFromImagesRoot].map((value) => normalizeLookupKey(value));
    for (const key of keys) {
      if (!imageKeyToAbs.has(key)) {
        imageKeyToAbs.set(key, imageAbs);
      }
    }
  }

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

  return { keyToRoute, imageKeyToAbs };
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

function normalizeInternalPath(urlPath) {
  if (!urlPath.startsWith('/')) {
    return urlPath;
  }

  const [pathWithoutHash, hash = ''] = urlPath.split('#');
  const [pathWithoutQuery, query = ''] = pathWithoutHash.split('?');
  const segments = pathWithoutQuery.split('/').filter(Boolean);

  if (segments.length < 2) {
    return urlPath;
  }

  const collection = segments[0];
  const knownCollections = new Set(['lore', 'places', 'sentients', 'bestiary', 'flora', 'factions', 'systems', 'meta', 'campaigns']);
  if (!knownCollections.has(collection)) {
    return urlPath;
  }

  const normalized = [collection, ...segments.slice(1).map((part) => slugifySegment(decodeURIComponent(part)))].join('/');
  const suffix = `${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
  return `/${normalized}${suffix}`;
}

function resolveImageTarget(target, { repoRoot, wikiIndex }) {
  const cleaned = target.trim().replace(/^\.\//, '');
  if (!cleaned) {
    return null;
  }

  const imagesRoot = path.resolve(repoRoot, 'src/assets/images');
  const directCandidate = path.resolve(imagesRoot, cleaned);

  const candidates = [directCandidate];
  if (!path.extname(cleaned)) {
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(path.resolve(imagesRoot, `${cleaned}${ext}`));
    }
  }

  const baseName = path.basename(cleaned, path.extname(cleaned));
  const relNoExt = cleaned.replace(/\.[^.]+$/, '');
  const keys = [baseName, relNoExt].map((value) => normalizeLookupKey(value));
  for (const key of keys) {
    const mapped = wikiIndex.imageKeyToAbs.get(key);
    if (mapped) {
      candidates.push(mapped);
    }
  }

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
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
      const imageAbs = resolveImageTarget(target, { repoRoot, wikiIndex });
      if (!imageAbs) {
        return raw;
      }
      const imagePath = toRelativeMarkdownPath(destAbs, imageAbs);
      const altText = alias || path.basename(imageAbs, path.extname(imageAbs));
      return `![${altText}](<${imagePath}>)`;
    }

    const resolved = resolveWikiTarget(target, wikiIndex);
    if (!resolved) {
      return raw;
    }

    return `[${alias || target}](${normalizeInternalPath(resolved)})`;
  };

  const withEmbeds = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner) => replaceWikiSyntax(inner, true));
  const withWikiLinks = withEmbeds.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => replaceWikiSyntax(inner, false));
  const withAngleWrappedImagePaths = withWikiLinks.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, target) => {
    const cleanedTarget = target.trim();
    if (!cleanedTarget.includes(' ') || cleanedTarget.startsWith('<') || cleanedTarget.startsWith('http://') || cleanedTarget.startsWith('https://')) {
      return _match;
    }
    return `![${alt}](<${cleanedTarget}>)`;
  });

  return withAngleWrappedImagePaths.replace(/\]\((\/[^)]+)\)/g, (_match, href) => `](${normalizeInternalPath(href)})`);
}
