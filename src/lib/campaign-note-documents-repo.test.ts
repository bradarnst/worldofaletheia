import { describe, expect, it } from 'vitest';
import { CampaignNoteDocumentsRepo } from './campaign-note-documents-repo';
import type { D1DatabaseLike } from './d1';

type QueryHandler = (query: string, values: unknown[], method: 'first' | 'all' | 'run') => unknown;

function createDbMock(handler: QueryHandler): D1DatabaseLike {
  return {
    prepare(query: string) {
      let boundValues: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return this;
        },
        first<T = Record<string, unknown>>() {
          return Promise.resolve(handler(query, boundValues, 'first') as T | null);
        },
        all<T = Record<string, unknown>>() {
          return Promise.resolve({ results: (handler(query, boundValues, 'all') as T[]) ?? [] });
        },
        run() {
          return Promise.resolve(handler(query, boundValues, 'run') ?? {});
        },
      };
    },
  };
}

describe('CampaignNoteDocumentsRepo', () => {
  it('guards readable document queries by exact campaign slug and member/gm roles', async () => {
    let seenQuery = '';
    let seenValues: unknown[] = [];
    const repo = new CampaignNoteDocumentsRepo(
      createDbMock((query, values) => {
        seenQuery = query;
        seenValues = values;
        return null;
      }),
    );

    await repo.getReadableDocument({ campaignSlug: 'barry', documentId: 'barry-2026-06-20-7k3f9q', userId: 'user_1' });

    expect(seenQuery).toContain('campaign_slug = ?');
    expect(seenQuery).toContain('document_id = ?');
    expect(seenQuery).toContain("membership.role IN ('member', 'gm')");
    expect(seenQuery).toContain("campaign_note_documents.visibility = 'gm' AND membership.role = 'gm'");
    expect(seenValues).toEqual(['barry', 'barry-2026-06-20-7k3f9q', 'user_1']);
  });

  it('limits anonymous reads to public documents', async () => {
    let seenQuery = '';
    let seenValues: unknown[] = [];
    const repo = new CampaignNoteDocumentsRepo(
      createDbMock((query, values) => {
        seenQuery = query;
        seenValues = values;
        return [];
      }),
    );

    await repo.listReadableDocuments({ campaignSlug: 'barry', scope: 'session', sessionSlug: 'session-012', limit: 500 });

    expect(seenQuery).toContain("campaign_note_documents.visibility = 'public'");
    expect(seenQuery).toContain('session_slug = ?');
    expect(seenQuery).toContain('LIMIT ?');
    expect(seenValues).toEqual(['barry', 'session', 'session-012', 100]);
  });

  it('creates document index rows with campaignMembers visibility and R2 lookup metadata', async () => {
    let seenQuery = '';
    let seenValues: unknown[] = [];
    const repo = new CampaignNoteDocumentsRepo(
      createDbMock((query, values) => {
        seenQuery = query;
        seenValues = values;
        return { meta: { changes: 1 } };
      }),
    );

    await repo.createDocumentIndex({
      documentId: 'barry-2026-06-20-7k3f9q',
      campaignSlug: 'barry',
      scope: 'session',
      sessionSlug: 'session-012',
      title: 'Session Notes',
      visibility: 'campaignMembers',
      r2Key: 'campaign-notes/documents/v1/campaign=barry/scope=session/document=barry-2026-06-20-7k3f9q.md',
      contentHash: 'hash-1',
      r2Etag: 'etag-1',
      userId: 'user_1',
      createdAt: '2026-06-20T17:00:00.000Z',
      source: 'campaign-site',
    });

    expect(seenQuery).toContain('INSERT INTO campaign_note_documents');
    expect(seenValues).toEqual([
      'barry-2026-06-20-7k3f9q',
      'barry',
      'session',
      'session-012',
      'Session Notes',
      'campaignMembers',
      'campaign-notes/documents/v1/campaign=barry/scope=session/document=barry-2026-06-20-7k3f9q.md',
      'hash-1',
      'etag-1',
      'user_1',
      '2026-06-20T17:00:00.000Z',
      'campaign-site',
      '{}',
    ]);
  });

  it('updates document metadata only when the expected content hash still matches', async () => {
    let seenQuery = '';
    let seenValues: unknown[] = [];
    const repo = new CampaignNoteDocumentsRepo(
      createDbMock((query, values) => {
        seenQuery = query;
        seenValues = values;
        return { meta: { changes: 1 } };
      }),
    );

    await expect(
      repo.updateDocumentIndexAfterSave({
        campaignSlug: 'barry',
        documentId: 'barry-2026-06-20-7k3f9q',
        title: 'Updated Session Notes',
        visibility: 'campaignMembers',
        contentHash: 'hash-2',
        r2Etag: 'etag-2',
        expectedContentHash: 'hash-1',
        updatedByUserId: 'user_2',
        updatedAt: '2026-06-20T18:00:00.000Z',
      }),
    ).resolves.toBe('updated');

    expect(seenQuery).toContain('AND content_hash = ?10');
    expect(seenValues).toEqual([
      'barry',
      'barry-2026-06-20-7k3f9q',
      'Updated Session Notes',
      'campaignMembers',
      'hash-2',
      'etag-2',
      'user_2',
      '2026-06-20T18:00:00.000Z',
      null,
      'hash-1',
    ]);
  });

  it('reports a conflict when no row matches the expected content hash', async () => {
    const repo = new CampaignNoteDocumentsRepo(createDbMock(() => ({ meta: { changes: 0 } })));

    await expect(
      repo.updateDocumentIndexAfterSave({
        campaignSlug: 'barry',
        documentId: 'barry-2026-06-20-7k3f9q',
        title: 'Updated Session Notes',
        visibility: 'campaignMembers',
        contentHash: 'hash-3',
        r2Etag: null,
        expectedContentHash: 'stale-hash',
        updatedByUserId: 'user_2',
        updatedAt: '2026-06-20T18:00:00.000Z',
      }),
    ).resolves.toBe('conflict');
  });
});
