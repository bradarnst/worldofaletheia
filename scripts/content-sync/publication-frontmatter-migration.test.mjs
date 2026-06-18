import { describe, expect, it } from 'vitest';
import {
  createPublicationTemplateFields,
  planPublicationMetadataMigration,
} from './publication-frontmatter-migration.mjs';

describe('publication frontmatter migration helpers', () => {
  it('defaults new content templates to preview-only publication', () => {
    expect(createPublicationTemplateFields()).toEqual({
      publication: 'preview',
      contentState: 'unfinished',
      audienceWarnings: [],
    });
  });

  it('maps legacy archived status to archive and other legacy status values to publish', () => {
    expect(planPublicationMetadataMigration({ status: 'archived' }).publication).toBe('archive');
    expect(planPublicationMetadataMigration({ status: 'draft' }).publication).toBe('publish');
  });
});
