-- Create or update an auth user row.
-- Replace placeholders before execution.
-- Canonical policy: `email` should already be trim(lower(email)).

INSERT INTO "user" (
  id,
  name,
  email,
  email_canonical,
  canonical_conflict,
  emailVerified,
  image,
  createdAt,
  updatedAt
)
VALUES (
  '<userId>',
  '<name>',
  trim(lower('<email>')),
  trim(lower('<email>')),
  0,
  <emailVerified_0_or_1>,
  NULL,
  '<ISO8601>',
  '<ISO8601>'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  email_canonical = excluded.email_canonical,
  emailVerified = excluded.emailVerified,
  updatedAt = excluded.updatedAt;
