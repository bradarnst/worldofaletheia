# Spell storage D1 verification

## Local verification

1. Validate the active canonical store through the D1-backed read path:
   - `pnpm validate:spells`
2. Run read-only sanity queries through Wrangler:
   - `pnpm db:query:spells -- "SELECT COUNT(*) AS total_spells FROM spells;"`
   - `pnpm db:query:spells -- "SELECT COUNT(*) AS total_spell_types FROM spell_types;"`
   - `pnpm db:query:spells -- "SELECT spell_type, COUNT(*) AS total FROM spell_type_memberships GROUP BY spell_type ORDER BY spell_type COLLATE NOCASE;"`

## Deployed D1 verification

Production Worker (`woa-admin`, D1 database `world-of-aletheia`):

1. Sanity-check the production remote database:
   - `pnpm db:query:spells:remote -- "SELECT COUNT(*) AS total_spells FROM spells;"`

Preview Worker (`woa-admin-preview`, D1 database `world-of-aletheia-staging`):

1. Sanity-check the preview remote database:
   - `pnpm db:query:spells:preview -- "SELECT COUNT(*) AS total_spells FROM spells;"`

## Runtime wiring

- Cloudflare binding name: `DB`
- Request-time access pattern: `event.platform.env.DB`, wired into `event.locals.spellDatabaseClient` by `src/hooks.server.ts`
- Local app runtime: `pnpm dev` / `pnpm preview` use adapter-cloudflare's platform proxy backed by the Wrangler config in `wrangler.jsonc`
- Local script/query path: `pnpm wrangler d1 execute DB --local ...`
- Production query path: `pnpm db:query:spells:remote -- "SELECT 1 AS ok;"`
- Preview query path: `pnpm wrangler d1 execute DB --remote --env preview ...`
- Human access on deployed environments is gated upstream by Cloudflare Access; D1 access here is the server-side path and does not perform identity checks. See [admin-access-cloudflare-access](./admin-access-cloudflare-access.md).

## Current-state expectations

- Canonical persistence: D1 binding `DB`
- Admin runtime reads/writes: `src/lib/server/spells/database.ts` through `event.locals.spellDatabaseClient`
- Public read API: `src/routes/api/v1/**`
- Read-only operational inspection: `scripts/spell-db-query.ts`

## Verification gates

Before publish handoff, all of these should pass in order:

- `pnpm validate:spells`
- `pnpm test`
- `pnpm check`
- `pnpm build`
