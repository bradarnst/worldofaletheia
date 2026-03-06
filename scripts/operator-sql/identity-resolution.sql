-- Resolve ambiguous identities before applying assignment operations.
-- Replace placeholders before execution.

SELECT id,
       email,
       name,
       createdAt,
       updatedAt
FROM user
WHERE lower(email) = lower('<email>')
   OR lower(name) = lower('<name>')
ORDER BY createdAt ASC;

SELECT user_id,
       campaign_slug,
       role,
       created_at,
       updated_at
FROM campaign_memberships
WHERE user_id IN (
  SELECT id FROM user WHERE lower(email) = lower('<email>')
)
ORDER BY campaign_slug ASC;
