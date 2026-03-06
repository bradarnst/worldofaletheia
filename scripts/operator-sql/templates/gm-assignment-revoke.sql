-- Revoke campaign GM mapping.
-- Replace placeholders before execution.

DELETE FROM campaign_gm_assignments
WHERE campaign_slug = '<campaignSlug>';
