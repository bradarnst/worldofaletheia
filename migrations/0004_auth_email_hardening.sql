-- Auth email hardening (Option A2)
-- Canonical policy: user.email stores trim(lower(email)).
-- Conflict policy: fail fast on duplicate normalized emails unless operator intentionally forces overwrite prior to apply.

-- Normalize storage in place for deterministic lookup.
UPDATE "user"
SET email = trim(lower(email)),
    updatedAt = COALESCE(updatedAt, datetime('now'))
WHERE email IS NOT NULL
  AND email <> trim(lower(email));

-- Strict uniqueness: this will fail if duplicate normalized emails remain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_unique
  ON "user"(email);
