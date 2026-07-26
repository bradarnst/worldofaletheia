# Campaign Content Source Boundary Setup

This setup is required before `worldofaletheia.com` can read Campaign Content from `woa-admin` through the server-to-server source boundary.

## Required configuration

Apply these values in each Cloudflare Workers environment that will read Campaign Content:

- `CAMPAIGN_CONTENT_SOURCE_BASE_URL` — the `woa-admin` origin for the same environment, for example `https://woa-admin.worldofaletheia.com`.
- `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET` — shared HMAC secret known only to `worldofaletheia.com` and `woa-admin` for that environment.
- `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE` — optional; defaults to the V1 contract audience `woa-admin:campaign-content:v1` and should only differ if the matching `woa-admin` environment expects a different audience.

## Setup steps

1. Generate a high-entropy secret per environment and store the same value in the matching `woa-admin` environment.
2. Set the main-site secrets with Wrangler or the Cloudflare dashboard. Use `--env staging` for staging and omit `--env` for production:

   ```bash
   pnpm wrangler secret put CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET
   pnpm wrangler secret put CAMPAIGN_CONTENT_SOURCE_BASE_URL
   ```

3. Remove any legacy `woa-admin:campaign-content-source:v1` audience override from `wrangler.jsonc` or delete a secret-based override in each deployed environment:

   ```bash
   pnpm wrangler secret delete CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE --env staging
   pnpm wrangler secret delete CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE
   ```

   If `woa-admin` requires a non-default audience, set the matching value as a non-secret environment variable or secret:

   ```bash
   pnpm wrangler secret put CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE
   ```

4. Redeploy the main site after the variables are present.

## Verification

- Run `pnpm test src/lib/campaign-content-source-boundary.test.ts` to verify assertion payloads, headers, validation, error mapping, and Campaign Content asset source reads.
- Run `pnpm test src/lib/campaign-content-live-loader.test.ts` to verify the `campaignContent` live-loader list/detail filter mapping, access-scope propagation, and that Markdown asset references are rewritten to main-site URLs before rendering.
- Run `pnpm test src/lib/campaign-content-asset-rewrite.test.ts` to verify `woa-admin` asset URLs and bucket-relative `assets/...` references are rewritten to the main-site asset route and unsafe source-boundary paths are neutralized.
- Run `pnpm test src/lib/campaign-content-asset-handler.test.ts` to verify the `/campaigns/{campaign}/assets/{path}` route applies the Campaign Gate + membership-derived visibility scope, serves readable assets for public/member/GM requests, blocks anonymous readers on campaignMembers-gated campaigns before any source fetch, and fails closed to generic 404/503 responses.
- In an environment wired to `woa-admin`, perform a campaign content read and verify `woa-admin` receives both `x-woa-runtime-actor` and `x-woa-runtime-signature` headers at the V1 `/collections/{collection}/documents` endpoint.
- Decode the assertion payload only in a trusted operator context and confirm `exp` is approximately 60 seconds after issuance, `operation` is `content:read`, `allowedVisibility` matches the reader scope, `campaignSlug` matches the requested campaign, and no email, display name, cookie, or session token appears in the payload.
- Verify anonymous, member, and GM reads return only their cumulative visibility scope and that missing, unreadable, malformed, rate-limited, and unavailable reads produce generic 404/503 browser behavior.

## Rollback and recovery

- To stop source reads, remove or rotate `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET` in either environment. Calls fail closed as unavailable.
- If a secret is exposed, rotate it in both `worldofaletheia.com` and `woa-admin`, then redeploy or restart both runtimes.
- If an environment points to the wrong `woa-admin` origin, correct `CAMPAIGN_CONTENT_SOURCE_BASE_URL` and redeploy before re-enabling Campaign Content routes.
- If the contract rollout must be reverted, deploy the preceding main-site release together with the matching `woa-admin` release; the assertion header, payload, and document routes must change as one unit.
