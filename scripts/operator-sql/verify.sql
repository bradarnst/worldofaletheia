SELECT 'memberships_total' AS metric, COUNT(*) AS value
FROM campaign_memberships;

SELECT 'memberships_by_role' AS metric,
       role,
       COUNT(*) AS value
FROM campaign_memberships
GROUP BY role
ORDER BY role;

SELECT user_id,
       campaign_slug,
       role,
       created_at,
       updated_at
FROM campaign_memberships
ORDER BY campaign_slug ASC, user_id ASC;

SELECT 'gm_assignments_total' AS metric, COUNT(*) AS value
FROM campaign_gm_assignments;

SELECT campaign_slug,
       user_id,
       created_at,
       updated_at
FROM campaign_gm_assignments
ORDER BY campaign_slug ASC;
