-- Auth email hardening (Option A2)
-- Canonical policy: trim(lower(email))
-- Conflict policy: never auto-merge/delete; record collisions and keep uniqueness guarded.

CREATE TABLE IF NOT EXISTS auth_email_conflicts (
  id TEXT PRIMARY KEY,
  canonical_email TEXT NOT NULL,
  winning_user_id TEXT NOT NULL,
  conflicting_user_id TEXT NOT NULL,
  winning_email_raw TEXT NOT NULL,
  conflicting_email_raw TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  resolution_notes TEXT,
  resolved_at TEXT,
  UNIQUE(canonical_email, winning_user_id, conflicting_user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_email_conflicts_canonical
  ON auth_email_conflicts(canonical_email);

CREATE INDEX IF NOT EXISTS idx_auth_email_conflicts_status
  ON auth_email_conflicts(status);

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

-- Reset conflict flags before recomputing current collision set.
UPDATE "user"
SET canonical_conflict = 0
WHERE canonical_conflict <> 0;

-- Mark canonical collisions as conflicts.
UPDATE "user"
SET canonical_conflict = 1
WHERE email_canonical IN (
  SELECT email_canonical
  FROM "user"
  WHERE email_canonical IS NOT NULL
    AND email_canonical <> ''
  GROUP BY email_canonical
  HAVING COUNT(*) > 1
);

-- Persist collision evidence for operator adjudication.
INSERT OR IGNORE INTO auth_email_conflicts (
  id,
  canonical_email,
  winning_user_id,
  conflicting_user_id,
  winning_email_raw,
  conflicting_email_raw,
  detected_at
)
SELECT
  'conflict:' || winner.email_canonical || ':' || winner.id || ':' || loser.id AS id,
  winner.email_canonical,
  winner.id,
  loser.id,
  winner.email,
  loser.email,
  datetime('now')
FROM "user" AS winner
JOIN "user" AS loser
  ON winner.email_canonical = loser.email_canonical
 AND winner.id < loser.id
WHERE winner.email_canonical IS NOT NULL
  AND winner.email_canonical <> '';

-- Guarded uniqueness: enforce for non-conflicting rows only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_canonical_unique_non_conflict
  ON "user"(email_canonical)
  WHERE canonical_conflict = 0 AND email_canonical IS NOT NULL AND email_canonical <> '';
