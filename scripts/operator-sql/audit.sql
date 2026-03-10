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

SELECT 'auth_session_table_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND name = 'session'
       ) AS value;

SELECT 'auth_verification_table_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND name = 'verification'
       ) AS value;

SELECT 'auth_email_conflicts_table_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND name = 'auth_email_conflicts'
       ) AS value;

SELECT 'auth_user_email_column_present' AS check_name,
       EXISTS(
         SELECT 1 FROM pragma_table_info('user') WHERE name = 'email'
       ) AS value;

SELECT 'auth_user_email_verified_column_present' AS check_name,
       EXISTS(
         SELECT 1 FROM pragma_table_info('user') WHERE name = 'emailVerified'
       ) AS value;

SELECT 'auth_user_email_canonical_column_present' AS check_name,
       EXISTS(
         SELECT 1 FROM pragma_table_info('user') WHERE name = 'email_canonical'
       ) AS value;

SELECT 'auth_verification_expires_at_column_present' AS check_name,
       EXISTS(
         SELECT 1 FROM pragma_table_info('verification') WHERE name = 'expiresAt'
       ) AS value;

SELECT 'auth_account_provider_account_unique_index_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_account_provider_account_unique'
       ) AS value;

SELECT 'auth_user_email_canonical_unique_non_conflict_index_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_user_email_canonical_unique_non_conflict'
       ) AS value;

SELECT 'auth_session_user_index_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_session_user_id'
       ) AS value;

SELECT 'auth_verification_identifier_value_unique_index_present' AS check_name,
       EXISTS(
         SELECT 1
         FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_verification_identifier_value_unique'
       ) AS value;

SELECT 'auth_null_or_empty_email_rows' AS metric,
       COUNT(*) AS value
FROM "user"
WHERE email IS NULL OR trim(email) = '';

SELECT 'auth_non_canonical_email_rows' AS metric,
       COUNT(*) AS value
FROM "user"
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

SELECT 'auth_duplicate_canonical_email_groups' AS metric,
       COUNT(*) AS value
FROM (
  SELECT email_canonical
  FROM "user"
  WHERE email_canonical IS NOT NULL
    AND email_canonical <> ''
  GROUP BY email_canonical
  HAVING COUNT(*) > 1
);

SELECT 'auth_email_conflicts_open' AS metric,
       COUNT(*) AS value
FROM auth_email_conflicts
WHERE status = 'open';

SELECT canonical_email,
       winning_user_id,
       conflicting_user_id,
       winning_email_raw,
       conflicting_email_raw,
       detected_at,
       status,
       resolved_at
FROM auth_email_conflicts
ORDER BY detected_at DESC, canonical_email ASC;

SELECT id,
       email,
       email_canonical,
       canonical_conflict,
       emailVerified,
       createdAt,
       updatedAt
FROM "user"
ORDER BY createdAt ASC, id ASC;

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
