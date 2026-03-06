# Operator SQL Templates (Option A2)

This directory contains **placeholder-only** SQL templates for production operator workflows.

Rules:

1. Do not put real identities or sensitive assignment data into tracked files.
2. Copy templates into a private gitignored path (for example `./.wrangler/operators/`) before filling values.
3. Keep private execution files under `./.wrangler/operators/` only; this path is gitignored and must never be force-added.
4. Apply with Wrangler using `--file` commands from [`package.json`](package.json).
5. Always run preflight and post-operation verification queries.

Suggested local workflow:

```bash
mkdir -p ./.wrangler/operators
cp ./scripts/operator-sql/templates/membership-grant.sql ./.wrangler/operators/op.sql
# edit placeholders in ./.wrangler/operators/op.sql
OP_FILE=./.wrangler/operators/op.sql pnpm run ops:a2:apply:staging
pnpm run ops:a2:verify:staging
```

Template files:

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

