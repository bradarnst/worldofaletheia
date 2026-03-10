-- Update only an existing auth user email with canonicalization.
-- Replace placeholders before execution.

UPDATE "user"
SET email = trim(lower('<email>')),
    email_canonical = trim(lower('<email>')),
    updatedAt = '<ISO8601>'
WHERE id = '<userId>';

-- Verify target row after update.
SELECT id, email, email_canonical, updatedAt
FROM "user"
WHERE id = '<userId>';
