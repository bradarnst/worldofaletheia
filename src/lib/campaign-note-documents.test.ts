import { describe, expect, it } from 'vitest';
import {
  buildCampaignNoteDocumentR2Key,
  createCampaignNoteContentHash,
  documentVersionMatches,
  validateCampaignNoteMarkdown,
} from './campaign-note-documents';

const validMarkdown = `---
collection: campaignSessions
campaign: barry
documentId: barry-2026-06-20-7k3f9q
type: session-note
title: Session Notes - 2026-06-20
visibility: campaignMembers
authors:
  - user_123
sessionDate: 2026-06-20
source: campaign-site
createdAt: 2026-06-20T17:00:00.000Z
updatedAt: 2026-06-20T17:20:00.000Z
version: hash-1
---

# Notes

The party entered the city.
`;

describe('campaign note document helpers', () => {
  it('builds R2 keys with encoded campaign slugs and safe document ids', () => {
    expect(
      buildCampaignNoteDocumentR2Key({
        campaignSlug: 'crown/fall',
        scope: 'session',
        documentId: 'crownfall-2026-06-20-z8p2aa',
      }),
    ).toBe(
      'campaign-notes/documents/v1/campaign=crown%2Ffall/scope=session/document=crownfall-2026-06-20-z8p2aa.md',
    );
  });

  it('rejects document ids that would act as paths or complete filenames', () => {
    expect(() =>
      buildCampaignNoteDocumentR2Key({ campaignSlug: 'barry', scope: 'session', documentId: '../escape' }),
    ).toThrow('documentId must be a safe filename stem');
    expect(() =>
      buildCampaignNoteDocumentR2Key({ campaignSlug: 'barry', scope: 'session', documentId: 'notes.md' }),
    ).toThrow('documentId must be a safe filename stem');
  });

  it('validates the campaign note Markdown frontmatter contract', () => {
    const result = validateCampaignNoteMarkdown(validMarkdown, {
      expectedCampaignSlug: 'barry',
      expectedDocumentId: 'barry-2026-06-20-7k3f9q',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.document.frontmatter).toMatchObject({
      collection: 'campaignSessions',
      campaign: 'barry',
      documentId: 'barry-2026-06-20-7k3f9q',
      visibility: 'campaignMembers',
      authors: ['user_123'],
      source: 'campaign-site',
    });
    expect(result.document.body).toContain('The party entered the city.');
  });

  it('rejects mismatched campaign identity and missing authors', () => {
    const invalid = validMarkdown
      .replace('campaign: barry', 'campaign: other-campaign')
      .replace('authors:\n  - user_123\n', 'authors:\n');

    const result = validateCampaignNoteMarkdown(invalid, { expectedCampaignSlug: 'barry' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors).toContain('Campaign note authors must include at least one author');
    expect(result.errors).toContain('Campaign note campaign frontmatter does not match the route campaign slug');
  });

  it('creates stable SHA-256 content hashes for version checks', async () => {
    await expect(createCampaignNoteContentHash('same markdown')).resolves.toBe(
      await createCampaignNoteContentHash('same markdown'),
    );
    expect(await createCampaignNoteContentHash('same markdown')).not.toBe(await createCampaignNoteContentHash('changed'));
  });

  it('requires an exact non-empty document version match', () => {
    expect(documentVersionMatches('hash-1', 'hash-1')).toBe(true);
    expect(documentVersionMatches('hash-1', 'hash-2')).toBe(false);
    expect(documentVersionMatches('', 'hash-1')).toBe(false);
  });
});
