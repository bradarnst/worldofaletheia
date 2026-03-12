CREATE TABLE IF NOT EXISTS campaign_gm_assignments_next (
  campaign_slug TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  PRIMARY KEY (campaign_slug, user_id)
);

INSERT OR IGNORE INTO campaign_gm_assignments_next (campaign_slug, user_id, created_at, updated_at)
SELECT DISTINCT campaign_slug, user_id, created_at, updated_at
FROM campaign_gm_assignments
WHERE campaign_slug IS NOT NULL
  AND campaign_slug <> ''
  AND user_id IS NOT NULL
  AND user_id <> '';

DROP TABLE campaign_gm_assignments;

ALTER TABLE campaign_gm_assignments_next RENAME TO campaign_gm_assignments;

CREATE INDEX IF NOT EXISTS idx_campaign_gm_assignments_user_id
  ON campaign_gm_assignments(user_id);
