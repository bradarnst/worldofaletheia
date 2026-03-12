-- Assign or update campaign GM mapping.
-- Replace placeholders before execution.

INSERT INTO campaign_gm_assignments (campaign_slug, user_id, created_at, updated_at)
VALUES ('<campaignSlug>', '<userId>', '<ISO8601>', '<ISO8601>')
ON CONFLICT(campaign_slug, user_id) DO UPDATE SET
  updated_at = excluded.updated_at;
