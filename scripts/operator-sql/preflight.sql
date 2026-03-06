SELECT 'table_exists' AS check_name, name AS value
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('campaign_memberships', 'campaign_gm_assignments')
ORDER BY name;

SELECT 'membership_table_shape' AS check_name,
       COUNT(*) AS column_count
FROM pragma_table_info('campaign_memberships');

SELECT 'gm_table_shape' AS check_name,
       COUNT(*) AS column_count
FROM pragma_table_info('campaign_gm_assignments');
