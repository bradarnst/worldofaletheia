-- Revoke membership from a user for a campaign.
-- Replace placeholders before execution.

DELETE FROM campaign_memberships
WHERE user_id = '<userId>'
  AND campaign_slug = '<campaignSlug>';
