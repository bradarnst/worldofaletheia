SELECT 'auth_user_table_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND name = 'user'
       ) AS value;

SELECT 'auth_account_table_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND name = 'account'
       ) AS value;

SELECT 'campaign_memberships_total' AS metric, COUNT(*) AS value
FROM campaign_memberships;

SELECT campaign_slug,
       COUNT(*) AS membership_count
FROM campaign_memberships
GROUP BY campaign_slug
ORDER BY campaign_slug;

SELECT role,
       COUNT(*) AS role_count
FROM campaign_memberships
GROUP BY role
ORDER BY role;

SELECT 'campaign_gm_assignments_total' AS metric, COUNT(*) AS value
FROM campaign_gm_assignments;

SELECT campaign_slug,
       user_id,
       created_at,
       updated_at
FROM campaign_gm_assignments
ORDER BY campaign_slug;
