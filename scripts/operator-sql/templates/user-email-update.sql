-- Update only an existing auth user email with canonicalization.
-- Replace placeholders before execution.

UPDATE "user"
SET email = trim(lower('<email>')),
    email_canonical = trim(lower('<email>')),
    canonical_conflict = 0,
    updatedAt = '<ISO8601>'
WHERE id = '<userId>';

-- Verify target row after update.
SELECT id, email, email_canonical, canonical_conflict, updatedAt
FROM "user"
WHERE id = '<userId>';
