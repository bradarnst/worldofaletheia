-- Link an existing auth user to an OAuth provider account in Better Auth account table.
-- Replace placeholders before execution.
-- NOTE: Use only when manual account-link correction is required.

INSERT INTO account (
  id,
  accountId,
  providerId,
  userId,
  accessToken,
  refreshToken,
  idToken,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
  scope,
  password,
  createdAt,
  updatedAt
)
VALUES (
  '<accountRowId>',
  '<providerAccountId>',
  '<providerId>',
  '<userId>',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '<ISO8601>',
  '<ISO8601>'
)
ON CONFLICT(id) DO UPDATE SET
  accountId = excluded.accountId,
  providerId = excluded.providerId,
  userId = excluded.userId,
  updatedAt = excluded.updatedAt;
