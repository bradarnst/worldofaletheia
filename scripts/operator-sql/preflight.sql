SELECT 'table_exists' AS check_name, name AS value
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'campaign_memberships',
    'user',
    'account',
    'session',
    'verification'
  )
ORDER BY name;

SELECT 'column_exists' AS check_name, 'user.email' AS value
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('user') WHERE name = 'email'
);

SELECT 'column_exists' AS check_name, 'user.emailVerified' AS value
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('user') WHERE name = 'emailVerified'
);

SELECT 'column_exists' AS check_name, 'verification.expiresAt' AS value
WHERE EXISTS (
  SELECT 1 FROM pragma_table_info('verification') WHERE name = 'expiresAt'
);

SELECT 'index_exists' AS check_name, name AS value
FROM sqlite_master
WHERE type = 'index'
  AND name IN (
    'idx_account_provider_account_unique',
    'idx_session_user_id',
    'idx_verification_identifier_value_unique',
    'idx_user_email_unique'
  )
ORDER BY name;

SELECT 'data_quality' AS check_name,
       'null_or_empty_email' AS value,
       COUNT(*) AS issue_count
FROM "user"
WHERE email IS NULL OR trim(email) = '';

SELECT 'data_quality' AS check_name,
       'non_normalized_email_rows' AS value,
       COUNT(*) AS issue_count
FROM "user"
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

SELECT 'data_quality' AS check_name,
       'duplicate_normalized_email_groups' AS value,
       COUNT(*) AS issue_count
FROM (
  SELECT trim(lower(email)) AS normalized_email
  FROM "user"
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY trim(lower(email))
  HAVING COUNT(*) > 1
);
