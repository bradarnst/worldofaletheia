SELECT 'memberships_total' AS metric, COUNT(*) AS value
FROM campaign_memberships;

SELECT 'memberships_invalid_role_rows' AS metric, COUNT(*) AS value
FROM campaign_memberships
WHERE role IS NULL OR role NOT IN ('member', 'gm');

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

SELECT 'auth_users_total' AS metric, COUNT(*) AS value
FROM "user";

SELECT 'auth_accounts_total' AS metric, COUNT(*) AS value
FROM account;

SELECT 'auth_sessions_total' AS metric, COUNT(*) AS value
FROM session;

SELECT 'auth_verification_total' AS metric, COUNT(*) AS value
FROM verification;

SELECT 'null_or_empty_email_rows' AS metric, COUNT(*) AS value
FROM "user"
WHERE email IS NULL OR trim(email) = '';

SELECT 'non_normalized_email_rows' AS metric, COUNT(*) AS value
FROM "user"
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

SELECT 'duplicate_normalized_email_groups' AS metric, COUNT(*) AS value
FROM (
  SELECT trim(lower(email)) AS normalized_email
  FROM "user"
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY trim(lower(email))
  HAVING COUNT(*) > 1
);

SELECT id,
       email,
       emailVerified,
       createdAt,
       updatedAt
FROM "user"
ORDER BY createdAt ASC, id ASC;
