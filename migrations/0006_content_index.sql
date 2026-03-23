CREATE TABLE IF NOT EXISTS content_index (
  id TEXT PRIMARY KEY,
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
  CHECK (visibility IS NULL OR visibility IN ('public', 'campaignMembers', 'gm'))
);

CREATE INDEX IF NOT EXISTS idx_content_index_collection_type_subtype
  ON content_index(collection, type, subtype, updated_at DESC, slug ASC);

CREATE INDEX IF NOT EXISTS idx_content_index_collection_slug
  ON content_index(collection, slug);

CREATE INDEX IF NOT EXISTS idx_content_index_visibility_campaign
  ON content_index(visibility, campaign_slug, collection);

CREATE INDEX IF NOT EXISTS idx_content_index_source_etag
  ON content_index(source_etag);
