export type CampaignNoteDocumentScope = 'campaign' | 'session';
export type CampaignNoteDocumentVisibility = 'public' | 'campaignMembers' | 'gm';
export type CampaignNoteDocumentSource = 'campaign-site' | 'obsidian' | 'import' | 'system';

const VISIBILITIES = new Set<CampaignNoteDocumentVisibility>(['public', 'campaignMembers', 'gm']);
const SOURCES = new Set<CampaignNoteDocumentSource>(['campaign-site', 'obsidian', 'import', 'system']);
const DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export interface CampaignNoteFrontmatter {
  collection: 'campaignSessions';
  campaign: string;
  documentId: string;
  type: 'session-note';
  title: string;
  visibility: CampaignNoteDocumentVisibility;
  authors: string[];
  sessionDate?: string;
  source: CampaignNoteDocumentSource;
  createdAt: string;
  updatedAt: string;
  version?: string;
}

export interface ParsedCampaignNoteMarkdown {
  frontmatter: CampaignNoteFrontmatter;
  body: string;
}

export type CampaignNoteMarkdownValidationResult =
  | { ok: true; document: ParsedCampaignNoteMarkdown }
  | { ok: false; errors: string[] };

export interface CampaignNoteValidationOptions {
  expectedCampaignSlug?: string;
  expectedDocumentId?: string;
}

interface RawFrontmatter {
  fields: Map<string, string>;
  authors: string[];
}

function getRequiredField(raw: RawFrontmatter, key: string, errors: string[]): string {
  const value = raw.fields.get(key)?.trim() ?? '';
  if (!value) {
    errors.push(`Missing required frontmatter field: ${key}`);
  }
  return value;
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function parseInlineStringList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => stripYamlQuotes(item.trim()))
    .filter((item) => item.length > 0);
}

function parseRawFrontmatter(frontmatterText: string): RawFrontmatter {
  const fields = new Map<string, string>();
  const authors: string[] = [];
  let activeList: 'authors' | null = null;

  for (const line of frontmatterText.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (activeList === 'authors' && listMatch) {
      authors.push(stripYamlQuotes(listMatch[1]));
      continue;
    }

    activeList = null;
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!fieldMatch) {
      continue;
    }

    const [, key, rawValue] = fieldMatch;
    if (key === 'authors') {
      activeList = 'authors';
      authors.push(...parseInlineStringList(rawValue));
      fields.set(key, rawValue.trim());
      continue;
    }

    fields.set(key, stripYamlQuotes(rawValue));
  }

  return {
    fields,
    authors: [...new Set(authors.map((author) => author.trim()).filter((author) => author.length > 0))],
  };
}

function isVisibility(value: string): value is CampaignNoteDocumentVisibility {
  return VISIBILITIES.has(value as CampaignNoteDocumentVisibility);
}

function isSource(value: string): value is CampaignNoteDocumentSource {
  return SOURCES.has(value as CampaignNoteDocumentSource);
}

export function buildCampaignNoteDocumentR2Key(options: {
  campaignSlug: string;
  scope: CampaignNoteDocumentScope;
  documentId: string;
}): string {
  const campaignSlug = options.campaignSlug.trim();
  const documentId = options.documentId.trim();

  if (!campaignSlug) {
    throw new Error('campaignSlug is required to build a campaign note R2 key');
  }

  if (!DOCUMENT_ID_PATTERN.test(documentId) || documentId.endsWith('.md')) {
    throw new Error('documentId must be a safe filename stem without a .md extension');
  }

  return [
    'campaign-notes/documents/v1',
    `campaign=${encodeURIComponent(campaignSlug)}`,
    `scope=${options.scope}`,
    `document=${encodeURIComponent(documentId)}.md`,
  ].join('/');
}

export async function createCampaignNoteContentHash(markdown: string): Promise<string> {
  const bytes = new TextEncoder().encode(markdown);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function documentVersionMatches(expectedVersion: string, currentVersion: string): boolean {
  return expectedVersion.trim().length > 0 && expectedVersion === currentVersion;
}

export function validateCampaignNoteMarkdown(
  markdown: string,
  options: CampaignNoteValidationOptions = {},
): CampaignNoteMarkdownValidationResult {
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return { ok: false, errors: ['Campaign note Markdown must start with YAML frontmatter'] };
  }

  const raw = parseRawFrontmatter(frontmatterMatch[1]);
  const errors: string[] = [];
  const collection = getRequiredField(raw, 'collection', errors);
  const campaign = getRequiredField(raw, 'campaign', errors);
  const documentId = getRequiredField(raw, 'documentId', errors);
  const type = getRequiredField(raw, 'type', errors);
  const title = getRequiredField(raw, 'title', errors);
  const visibility = getRequiredField(raw, 'visibility', errors);
  const source = getRequiredField(raw, 'source', errors);
  const createdAt = getRequiredField(raw, 'createdAt', errors);
  const updatedAt = getRequiredField(raw, 'updatedAt', errors);
  const version = raw.fields.get('version')?.trim() || undefined;
  const sessionDate = raw.fields.get('sessionDate')?.trim() || undefined;

  if (collection && collection !== 'campaignSessions') {
    errors.push('Campaign note collection must be campaignSessions');
  }

  if (type && type !== 'session-note') {
    errors.push('Campaign note type must be session-note');
  }

  if (visibility && !isVisibility(visibility)) {
    errors.push('Campaign note visibility must be public, campaignMembers, or gm');
  }

  if (source && !isSource(source)) {
    errors.push('Campaign note source must be campaign-site, obsidian, import, or system');
  }

  if (documentId && (!DOCUMENT_ID_PATTERN.test(documentId) || documentId.endsWith('.md'))) {
    errors.push('Campaign note documentId must be a safe filename stem without a .md extension');
  }

  if (raw.authors.length === 0) {
    errors.push('Campaign note authors must include at least one author');
  }

  if (options.expectedCampaignSlug && campaign && campaign !== options.expectedCampaignSlug) {
    errors.push('Campaign note campaign frontmatter does not match the route campaign slug');
  }

  if (options.expectedDocumentId && documentId && documentId !== options.expectedDocumentId) {
    errors.push('Campaign note documentId frontmatter does not match the requested document id');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    document: {
      frontmatter: {
        collection: 'campaignSessions',
        campaign,
        documentId,
        type: 'session-note',
        title,
        visibility: visibility as CampaignNoteDocumentVisibility,
        authors: raw.authors,
        sessionDate,
        source: source as CampaignNoteDocumentSource,
        createdAt,
        updatedAt,
        version,
      },
      body: markdown.slice(frontmatterMatch[0].length),
    },
  };
}
