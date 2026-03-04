CREATE TABLE IF NOT EXISTS campaign_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_slug TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(user_id, campaign_slug)
);

CREATE INDEX IF NOT EXISTS idx_campaign_memberships_campaign_slug
  ON campaign_memberships(campaign_slug);

CREATE INDEX IF NOT EXISTS idx_campaign_memberships_user_id
  ON campaign_memberships(user_id);

