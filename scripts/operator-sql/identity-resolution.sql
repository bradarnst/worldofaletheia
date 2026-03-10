-- Resolve ambiguous identities before applying assignment operations.
-- Replace placeholders before execution.
-- Canonical policy: trim(lower(email)).

WITH email_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE email_canonical = trim(lower('<email>'))
),
name_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE lower(name) = lower('<name>')
),
combined AS (
  SELECT * FROM email_match
  UNION
  SELECT * FROM name_match
)
SELECT 'resolution_summary' AS result_type,
       CASE
         WHEN (SELECT COUNT(*) FROM email_match) = 1 THEN 1
         ELSE 0
       END AS canonical_email_single_match,
       CASE
         WHEN (SELECT COUNT(*) FROM email_match) > 1 THEN 1
         ELSE 0
       END AS canonical_email_many_match,
       CASE
         WHEN (SELECT COUNT(*) FROM email_match) = 0 AND (SELECT COUNT(*) FROM name_match) = 1 THEN 1
         ELSE 0
       END AS name_fallback_single_match,
       CASE
         WHEN (SELECT COUNT(*) FROM email_match) = 0 AND (SELECT COUNT(*) FROM name_match) > 1 THEN 1
         ELSE 0
       END AS name_fallback_many_match,
       (SELECT COUNT(*) FROM combined) AS total_candidates;

WITH email_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE email_canonical = trim(lower('<email>'))
),
name_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE lower(name) = lower('<name>')
),
combined AS (
  SELECT * FROM email_match
  UNION
  SELECT * FROM name_match
)
SELECT 'resolution_candidate' AS result_type,
       id,
       email,
       email_canonical,
       name,
       createdAt,
       updatedAt
FROM combined
ORDER BY createdAt ASC, id ASC;

WITH email_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE email_canonical = trim(lower('<email>'))
),
name_match AS (
  SELECT id, email, email_canonical, name, createdAt, updatedAt
  FROM "user"
  WHERE lower(name) = lower('<name>')
),
combined AS (
  SELECT * FROM email_match
  UNION
  SELECT * FROM name_match
)
SELECT 'membership_context' AS result_type,
       cm.user_id,
       cm.campaign_slug,
       cm.role,
       cm.created_at,
       cm.updated_at
FROM campaign_memberships AS cm
WHERE cm.user_id IN (
  SELECT id FROM combined
)
ORDER BY cm.campaign_slug ASC, cm.user_id ASC;
