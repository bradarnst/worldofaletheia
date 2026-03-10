# Operator SQL Templates (Option A2)

This directory contains **placeholder-only** SQL templates for production operator workflows.

Rules:

1. Do not put real identities or sensitive assignment data into tracked files.
2. Copy templates into a private gitignored path (for example `./.wrangler/operators/`) before filling values.
3. Keep private execution files under `./.wrangler/operators/` only; this path is gitignored and must never be force-added.
4. Apply with Wrangler using `--file` commands from [`package.json`](package.json).
5. Always run preflight and post-operation verification queries.
6. Run migration plan dry-run first; do not proceed with apply when conflicts are reported unless an explicit force override is approved.

Suggested local workflow:

```bash
mkdir -p ./.wrangler/operators
pnpm db:migrate:plan:staging:dry-run
cp ./scripts/operator-sql/templates/membership-grant.sql ./.wrangler/operators/op.sql
# edit placeholders in ./.wrangler/operators/op.sql
OP_FILE=./.wrangler/operators/op.sql pnpm run ops:a2:apply:staging
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

1. canonical-email collisions under `trim(lower(email))`
2. schema/object conflicts (required table names occupied by incompatible objects)
3. required-column shape conflicts on existing auth tables

No `auth_email_conflicts` backlog table is used. Conflict handling is immediate: fail by default, or explicit `--force` override.

Template files:

- `templates/user-upsert.sql`
- `templates/user-email-update.sql`
- `templates/verification-upsert.sql`
- `templates/membership-grant.sql`
- `templates/membership-revoke.sql`
- `templates/membership-role-update.sql`
- `templates/gm-assignment-upsert.sql`
- `templates/gm-assignment-revoke.sql`
- `templates/account-link-upsert.sql`
- `templates/account-link-revoke.sql`

Validation/support files:

- `preflight.sql`
- `verify.sql`
- `audit.sql`
- `identity-resolution.sql`

Execution policy notes:

1. Email identity lookup is canonical-first: `trim(lower(email))`.
2. If canonical collisions exist, migration apply is blocked by default with actionable output listing canonical emails and conflicting user IDs.
3. `--force` is an explicit override path and may rewrite colliding duplicate identities to deterministic forced aliases before apply.
4. Migration runner stops on conflict by default and returns actionable conflict details; `--force` is an explicit override, not default behavior.
