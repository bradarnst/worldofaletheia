-- Auth email hardening (Option A2)
-- Canonical policy: trim(lower(email))
-- Conflict policy: fail fast on canonical collisions unless operator intentionally forces overwrite prior to apply.

-- Normalize storage in place for deterministic lookup.
UPDATE "user"
SET email = trim(lower(email)),
    updatedAt = COALESCE(updatedAt, datetime('now'))
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

-- Backfill canonical column from normalized email.
UPDATE "user"
SET email_canonical = trim(lower(email))
WHERE email IS NOT NULL
  AND (email_canonical IS NULL OR email_canonical <> trim(lower(email)));

-- Strict uniqueness: this will fail if duplicates remain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_canonical_unique
  ON "user"(email_canonical)
  WHERE email_canonical IS NOT NULL AND email_canonical <> '';
