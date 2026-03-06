CREATE TABLE IF NOT EXISTS campaign_gm_assignments (
  campaign_slug TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaign_gm_assignments_user_id
  ON campaign_gm_assignments(user_id);
