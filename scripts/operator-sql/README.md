# Operator SQL Diagnostics

This directory now contains read-only diagnostic SQL for public-site auth/D1 verification. Direct user, account, provider-link, verification-token, and campaign-membership mutation workflows moved to `woa-admin`.

Rules:

1. Do not put real identities or sensitive assignment data into tracked files.
2. Use `woa-admin` for administrative mutations.
3. Use these files only for preflight, verification, and audit-style read-only checks.
4. Run migration plan dry-run first; do not proceed with apply when conflicts are reported unless an explicit force override is approved.

Suggested verification workflow:

```bash
pnpm db:migrate:plan:staging:dry-run
pnpm run ops:a2:preflight:staging
pnpm run ops:a2:verify:staging
```

Migration plan command set (consistent local/staging/prod behavior):

- dry-run (no writes):
  - `pnpm db:migrate:plan:local:dry-run`
  - `pnpm db:migrate:plan:staging:dry-run`
  - `pnpm db:migrate:plan:prod:dry-run`
- apply (blocks on conflict by default):
  - `pnpm db:migrate:plan:local`
  - `pnpm db:migrate:plan:staging`
  - `pnpm db:migrate:plan:prod`
- force apply (override conflict block):
  - `pnpm db:migrate:plan:local:force`
  - `pnpm db:migrate:plan:staging:force`
  - `pnpm db:migrate:plan:prod:force`

Conflict classes detected by runner include:

1. normalized-email collisions under `trim(lower(email))`
2. schema/object conflicts (required table names occupied by incompatible objects)
3. required-column shape conflicts on existing auth tables
4. invalid `campaign_memberships.role` values outside `member|gm`

No `auth_email_conflicts` backlog table is used. Conflict handling is immediate: fail by default, or explicit `--force` override.

Validation/support files:

- `preflight.sql`
- `verify.sql`
- `audit.sql`

Execution policy notes:

1. Email identity lookup uses `user.email`, which stores `trim(lower(email))`.
2. If normalized-email collisions exist, migration apply is blocked by default with actionable output listing normalized emails and conflicting user IDs.
3. `--force` is an explicit override path and may rewrite colliding duplicate identities to deterministic forced aliases before apply.
4. Migration runner stops on conflict by default and returns actionable conflict details; `--force` is an explicit override, not default behavior.
5. Administrative repair and mutation workflows should be executed in `woa-admin`, not from copied SQL templates in this repo.
