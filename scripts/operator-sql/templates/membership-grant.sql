-- Grant or update membership role for a user in a campaign.
-- Replace placeholders before execution.

INSERT INTO campaign_memberships (id, user_id, campaign_slug, role, created_at, updated_at)
VALUES ('<userId>:<campaignSlug>', '<userId>', '<campaignSlug>', '<role>', '<ISO8601>', '<ISO8601>')
ON CONFLICT(user_id, campaign_slug) DO UPDATE SET
  role = excluded.role,
  updated_at = excluded.updated_at;
