ALTER TABLE content_index ADD COLUMN publication TEXT;
ALTER TABLE content_index ADD COLUMN content_state TEXT NOT NULL DEFAULT 'stable';
ALTER TABLE content_index ADD COLUMN audience_warnings_json TEXT NOT NULL DEFAULT '[]';

UPDATE content_index
SET publication = CASE
  WHEN LOWER(COALESCE(status, '')) IN ('archive', 'archived') THEN 'archive'
  ELSE 'publish'
END
WHERE publication IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_index_publication_collection
  ON content_index(publication, collection, updated_at DESC, slug ASC);
