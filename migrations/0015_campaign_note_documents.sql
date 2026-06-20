CREATE TABLE IF NOT EXISTS campaign_note_documents (
  document_id TEXT PRIMARY KEY,
  campaign_slug TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('campaign', 'session')),
  session_slug TEXT,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'campaignMembers' CHECK (visibility IN ('public', 'campaignMembers', 'gm')),
  r2_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  r2_etag TEXT,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'campaign-site' CHECK (source IN ('campaign-site', 'obsidian', 'import', 'system')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (
    (scope = 'campaign' AND session_slug IS NULL)
    OR (scope = 'session' AND session_slug IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_campaign_note_documents_campaign_updated
  ON campaign_note_documents(campaign_slug, updated_at DESC, document_id);

CREATE INDEX IF NOT EXISTS idx_campaign_note_documents_session_updated
  ON campaign_note_documents(campaign_slug, session_slug, updated_at DESC, document_id);

CREATE INDEX IF NOT EXISTS idx_campaign_note_documents_visibility
  ON campaign_note_documents(campaign_slug, visibility, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_note_documents_r2_key
  ON campaign_note_documents(r2_key);
