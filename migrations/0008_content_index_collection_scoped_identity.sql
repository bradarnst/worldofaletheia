DROP INDEX IF EXISTS idx_content_index_collection_type_subtype;
DROP INDEX IF EXISTS idx_content_index_collection_slug;
DROP INDEX IF EXISTS idx_content_index_visibility_campaign;
DROP INDEX IF EXISTS idx_content_index_source_etag;
DROP INDEX IF EXISTS idx_content_index_collection_id;

ALTER TABLE content_index RENAME TO content_index_legacy;

CREATE TABLE content_index (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  subtype TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  visibility TEXT,
  campaign_slug TEXT,
  summary TEXT,
  status TEXT,
  author TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_etag TEXT NOT NULL,
  source_last_modified TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  PRIMARY KEY (collection, id),
  CHECK (visibility IS NULL OR visibility IN ('public', 'campaignMembers', 'gm'))
);

INSERT INTO content_index (
  id,
  collection,
  slug,
  title,
  type,
  subtype,
  tags_json,
  visibility,
  campaign_slug,
  summary,
  status,
  author,
  created_at,
  updated_at,
  source_etag,
  source_last_modified,
  indexed_at,
  r2_key
)
SELECT
  id,
  collection,
  slug,
  title,
  type,
  subtype,
  tags_json,
  visibility,
  campaign_slug,
  summary,
  status,
  author,
  created_at,
  updated_at,
  source_etag,
  source_last_modified,
  indexed_at,
  r2_key
FROM content_index_legacy;

CREATE INDEX idx_content_index_collection_type_subtype
  ON content_index(collection, type, subtype, updated_at DESC, slug ASC);

CREATE INDEX idx_content_index_collection_slug
  ON content_index(collection, slug);

CREATE INDEX idx_content_index_visibility_campaign
  ON content_index(visibility, campaign_slug, collection);

CREATE INDEX idx_content_index_source_etag
  ON content_index(source_etag);

DROP TABLE content_index_legacy;
