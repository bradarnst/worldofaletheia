ALTER TABLE content_index ADD COLUMN r2_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_content_index_collection_id
  ON content_index(collection, id);
