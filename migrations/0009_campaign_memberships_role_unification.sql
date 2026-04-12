BEGIN TRANSACTION;

DROP TABLE IF EXISTS campaign_memberships_next;

CREATE TEMP TABLE campaign_memberships_role_guard (
  invalid_role_count INTEGER NOT NULL CHECK (invalid_role_count = 0)
);

INSERT INTO campaign_memberships_role_guard (invalid_role_count)
SELECT COUNT(*)
FROM campaign_memberships
WHERE role IS NULL OR role NOT IN ('member', 'gm');

CREATE TABLE campaign_memberships_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_slug TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'gm')),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(user_id, campaign_slug)
);

INSERT INTO campaign_memberships_next (id, user_id, campaign_slug, role, created_at, updated_at)
SELECT id, user_id, campaign_slug, role, created_at, updated_at
FROM campaign_memberships
WHERE role IN ('member', 'gm');

INSERT INTO campaign_memberships_next (id, user_id, campaign_slug, role, created_at, updated_at)
SELECT
  'campaign-membership-gm-backfill:' || g.campaign_slug || ':' || g.user_id,
  g.user_id,
  g.campaign_slug,
  'gm',
  g.created_at,
  g.updated_at
FROM campaign_gm_assignments g
WHERE 1 = 1
ON CONFLICT(user_id, campaign_slug) DO UPDATE SET
  role = 'gm',
  created_at = CASE
    WHEN campaign_memberships_next.created_at <= excluded.created_at THEN campaign_memberships_next.created_at
    ELSE excluded.created_at
  END,
  updated_at = CASE
    WHEN campaign_memberships_next.updated_at IS NULL THEN excluded.updated_at
    WHEN excluded.updated_at IS NULL THEN campaign_memberships_next.updated_at
    WHEN campaign_memberships_next.updated_at >= excluded.updated_at THEN campaign_memberships_next.updated_at
    ELSE excluded.updated_at
  END;

DROP TABLE campaign_memberships;

ALTER TABLE campaign_memberships_next RENAME TO campaign_memberships;

CREATE INDEX idx_campaign_memberships_campaign_slug
  ON campaign_memberships(campaign_slug);

CREATE INDEX idx_campaign_memberships_user_id
  ON campaign_memberships(user_id);

DROP TABLE campaign_memberships_role_guard;

COMMIT;
