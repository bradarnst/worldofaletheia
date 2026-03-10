-- Insert or refresh a verification challenge/token row.
-- Replace placeholders before execution.

INSERT INTO verification (
  id,
  identifier,
  value,
  expiresAt,
  createdAt,
  updatedAt
)
VALUES (
  '<verificationId>',
  '<identifier>',
  '<tokenOrChallengeValue>',
  '<ISO8601_EXPIRES_AT>',
  '<ISO8601_NOW>',
  '<ISO8601_NOW>'
)
ON CONFLICT(id) DO UPDATE SET
  identifier = excluded.identifier,
  value = excluded.value,
  expiresAt = excluded.expiresAt,
  updatedAt = excluded.updatedAt;
