import { type D1DatabaseLike, getMutationChangeCount } from './d1';
import type { CampaignNoteDocumentScope, CampaignNoteDocumentSource, CampaignNoteDocumentVisibility } from './campaign-note-documents';

interface CampaignNoteDocumentRecord {
  document_id: string;
  campaign_slug: string;
  scope: CampaignNoteDocumentScope;
  session_slug: string | null;
  title: string;
  visibility: CampaignNoteDocumentVisibility;
  r2_key: string;
  content_hash: string;
  r2_etag: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  source: CampaignNoteDocumentSource;
  metadata_json: string;
}

export interface CampaignNoteDocumentIndex {
  documentId: string;
  campaignSlug: string;
  scope: CampaignNoteDocumentScope;
  sessionSlug: string | null;
  title: string;
  visibility: CampaignNoteDocumentVisibility;
  r2Key: string;
  contentHash: string;
  r2Etag: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  source: CampaignNoteDocumentSource;
  metadataJson: string;
}

export interface CampaignNoteDocumentCreateInput {
  documentId: string;
  campaignSlug: string;
  scope: CampaignNoteDocumentScope;
  sessionSlug: string | null;
  title: string;
  visibility: CampaignNoteDocumentVisibility;
  r2Key: string;
  contentHash: string;
  r2Etag: string | null;
  userId: string;
  createdAt: string;
  source: CampaignNoteDocumentSource;
  metadataJson?: string;
}

export interface CampaignNoteDocumentSaveInput {
  documentId: string;
  campaignSlug: string;
  title: string;
  visibility: CampaignNoteDocumentVisibility;
  contentHash: string;
  r2Etag: string | null;
  expectedContentHash: string;
  updatedByUserId: string;
  updatedAt: string;
  metadataJson?: string;
}

export interface CampaignNoteDocumentListOptions {
  campaignSlug: string;
  userId?: string | null;
  scope?: CampaignNoteDocumentScope;
  sessionSlug?: string | null;
  limit?: number;
}

export type CampaignNoteDocumentSaveResult = 'updated' | 'conflict';

function toIndex(record: CampaignNoteDocumentRecord): CampaignNoteDocumentIndex {
  return {
    documentId: record.document_id,
    campaignSlug: record.campaign_slug,
    scope: record.scope,
    sessionSlug: record.session_slug,
    title: record.title,
    visibility: record.visibility,
    r2Key: record.r2_key,
    contentHash: record.content_hash,
    r2Etag: record.r2_etag,
    createdByUserId: record.created_by_user_id,
    updatedByUserId: record.updated_by_user_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    source: record.source,
    metadataJson: record.metadata_json,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit) || limit < 1) {
    return 50;
  }

  return Math.min(Math.floor(limit), 100);
}

function buildReadableVisibilitySql(userId: string | null): { sql: string; values: unknown[] } {
  if (!userId) {
    return {
      sql: "campaign_note_documents.visibility = 'public'",
      values: [],
    };
  }

  return {
    sql: `(
      campaign_note_documents.visibility = 'public'
      OR EXISTS (
        SELECT 1
        FROM campaign_memberships membership
        WHERE membership.user_id = ?
          AND membership.campaign_slug = campaign_note_documents.campaign_slug
          AND (
            (campaign_note_documents.visibility = 'campaignMembers' AND membership.role IN ('member', 'gm'))
            OR (campaign_note_documents.visibility = 'gm' AND membership.role = 'gm')
          )
        LIMIT 1
      )
    )`,
    values: [userId],
  };
}

export class CampaignNoteDocumentsRepo {
  constructor(private readonly db: D1DatabaseLike) {}

  async getReadableDocument(options: {
    campaignSlug: string;
    documentId: string;
    userId?: string | null;
  }): Promise<CampaignNoteDocumentIndex | null> {
    const access = buildReadableVisibilitySql(options.userId ?? null);
    const row = await this.db
      .prepare(
        `SELECT *
         FROM campaign_note_documents
         WHERE campaign_slug = ?
           AND document_id = ?
           AND ${access.sql}
         LIMIT 1`,
      )
      .bind(options.campaignSlug, options.documentId, ...access.values)
      .first<CampaignNoteDocumentRecord>();

    return row ? toIndex(row) : null;
  }

  async listReadableDocuments(options: CampaignNoteDocumentListOptions): Promise<CampaignNoteDocumentIndex[]> {
    const access = buildReadableVisibilitySql(options.userId ?? null);
    const clauses = ['campaign_slug = ?', access.sql];
    const values: unknown[] = [options.campaignSlug, ...access.values];

    if (options.scope) {
      clauses.push('scope = ?');
      values.push(options.scope);
    }

    if (options.sessionSlug !== undefined) {
      if (options.sessionSlug === null) {
        clauses.push('session_slug IS NULL');
      } else {
        clauses.push('session_slug = ?');
        values.push(options.sessionSlug);
      }
    }

    values.push(normalizeLimit(options.limit));

    const result = await this.db
      .prepare(
        `SELECT *
         FROM campaign_note_documents
         WHERE ${clauses.join(' AND ')}
         ORDER BY updated_at DESC, document_id ASC
         LIMIT ?`,
      )
      .bind(...values)
      .all<CampaignNoteDocumentRecord>();

    return result.results.map(toIndex);
  }

  async createDocumentIndex(input: CampaignNoteDocumentCreateInput): Promise<void> {
    const metadataJson = input.metadataJson ?? '{}';
    await this.db
      .prepare(
        `INSERT INTO campaign_note_documents (
           document_id,
           campaign_slug,
           scope,
           session_slug,
           title,
           visibility,
           r2_key,
           content_hash,
           r2_etag,
           created_by_user_id,
           updated_by_user_id,
           created_at,
           updated_at,
           source,
           metadata_json
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, ?11, ?12, ?13)`,
      )
      .bind(
        input.documentId,
        input.campaignSlug,
        input.scope,
        input.sessionSlug,
        input.title,
        input.visibility,
        input.r2Key,
        input.contentHash,
        input.r2Etag,
        input.userId,
        input.createdAt,
        input.source,
        metadataJson,
      )
      .run();
  }

  async updateDocumentIndexAfterSave(input: CampaignNoteDocumentSaveInput): Promise<CampaignNoteDocumentSaveResult> {
    const result = await this.db
      .prepare(
        `UPDATE campaign_note_documents
         SET title = ?3,
             visibility = ?4,
             content_hash = ?5,
             r2_etag = ?6,
             updated_by_user_id = ?7,
             updated_at = ?8,
             metadata_json = COALESCE(?9, metadata_json)
         WHERE campaign_slug = ?1
           AND document_id = ?2
           AND content_hash = ?10`,
      )
      .bind(
        input.campaignSlug,
        input.documentId,
        input.title,
        input.visibility,
        input.contentHash,
        input.r2Etag,
        input.updatedByUserId,
        input.updatedAt,
        input.metadataJson ?? null,
        input.expectedContentHash,
      )
      .run();

    const changes = getMutationChangeCount(result);
    // Fail closed: an unknown change count (unexpected driver result shape) is
    // treated as a conflict, never as a successful update, so stale writes are
    // never silently committed.
    return changes === null || changes === 0 ? 'conflict' : 'updated';
  }
}
