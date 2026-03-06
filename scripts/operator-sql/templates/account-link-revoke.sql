-- Remove a provider account link for a user in Better Auth account table.
-- Replace placeholders before execution.

DELETE FROM account
WHERE providerId = '<providerId>'
  AND accountId = '<providerAccountId>'
  AND userId = '<userId>';
