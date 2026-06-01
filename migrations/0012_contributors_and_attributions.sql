CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL,
  profile_mode TEXT NOT NULL DEFAULT 'standard',
  bio_excerpt TEXT,
  avatar TEXT,
  source_id TEXT,
  r2_key TEXT,
  indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attributions (
  contributor_id TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'content',
  target_collection TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role TEXT NOT NULL,
  indexed_at TEXT NOT NULL,

  PRIMARY KEY (
    contributor_id,
    target_type,
    target_collection,
    target_id,
    role
  ),

  FOREIGN KEY (contributor_id)
    REFERENCES contributors(id)
    ON DELETE CASCADE,

  FOREIGN KEY (target_collection, target_id)
    REFERENCES content_index(collection, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attributions_target
  ON attributions(target_type, target_collection, target_id);

CREATE INDEX IF NOT EXISTS idx_attributions_role
  ON attributions(role, contributor_id);
