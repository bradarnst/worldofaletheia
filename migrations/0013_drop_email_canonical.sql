-- Drop legacy user.email_canonical by rebuilding the Better Auth user table.
-- D1/SQLite compatibility: avoid ALTER TABLE DROP COLUMN and recreate required indexes.

DROP TABLE IF EXISTS user_next;

CREATE TABLE user_next (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL CHECK (email = trim(lower(email)) AND trim(email) <> ''),
  emailVerified INTEGER NOT NULL DEFAULT 0 CHECK (emailVerified IN (0, 1)),
  image TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

INSERT INTO user_next (id, name, email, emailVerified, image, createdAt, updatedAt)
SELECT id,
       name,
       trim(lower(email)),
       emailVerified,
       image,
       createdAt,
       updatedAt
FROM "user";

CREATE UNIQUE INDEX user_next_email_unique
  ON user_next(email);

DROP TABLE "user";
ALTER TABLE user_next RENAME TO "user";

DROP INDEX user_next_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_unique
  ON "user"(email);

CREATE INDEX IF NOT EXISTS idx_user_created_at
  ON "user"(createdAt);
