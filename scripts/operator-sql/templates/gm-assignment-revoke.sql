-- Deprecated after membership-role cutover. Burn-in parity only.
-- Revoke campaign GM mapping for one user.
-- Replace placeholders before execution.

DELETE FROM campaign_gm_assignments
WHERE campaign_slug = '<campaignSlug>'
  AND user_id = '<userId>';
