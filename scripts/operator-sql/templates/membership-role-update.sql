-- Update membership role only when membership row already exists.
-- Replace placeholders before execution.

UPDATE campaign_memberships
SET role = '<role>',
    updated_at = '<ISO8601>'
WHERE user_id = '<userId>'
  AND campaign_slug = '<campaignSlug>';

SELECT changes() AS rows_updated;
