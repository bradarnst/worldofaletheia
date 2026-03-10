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

SELECT 'non_canonical_email_rows' AS metric, COUNT(*) AS value
FROM "user"
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

SELECT 'duplicate_canonical_email_groups' AS metric, COUNT(*) AS value
FROM (
  SELECT email_canonical
  FROM "user"
  WHERE email_canonical IS NOT NULL
    AND email_canonical <> ''
  GROUP BY email_canonical
  HAVING COUNT(*) > 1
);

SELECT id,
       email,
       email_canonical,
       emailVerified,
       createdAt,
       updatedAt
FROM "user"
ORDER BY createdAt ASC, id ASC;
