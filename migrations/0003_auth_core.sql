-- Better Auth core persistence (Option A2)
-- Forward-only + idempotent schema bootstrap for D1/SQLite.

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  email_canonical TEXT,
  emailVerified INTEGER NOT NULL DEFAULT 0 CHECK (emailVerified IN (0, 1)),
  image TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_email
  ON "user"(email);

CREATE INDEX IF NOT EXISTS idx_user_email_canonical
  ON "user"(email_canonical);

CREATE INDEX IF NOT EXISTS idx_user_created_at
  ON "user"(createdAt);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider_account_unique
  ON account(providerId, accountId);

CREATE INDEX IF NOT EXISTS idx_account_user_id
  ON account(userId);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  userId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token_unique
  ON session(token);

CREATE INDEX IF NOT EXISTS idx_session_user_id
  ON session(userId);

CREATE INDEX IF NOT EXISTS idx_session_expires_at
  ON session(expiresAt);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_identifier_value_unique
  ON verification(identifier, value);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_value_unique
  ON verification(value);

CREATE INDEX IF NOT EXISTS idx_verification_expires_at
  ON verification(expiresAt);
