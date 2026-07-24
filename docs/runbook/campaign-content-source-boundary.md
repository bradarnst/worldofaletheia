# Campaign Content Source Boundary Setup

This setup is required before `worldofaletheia.com` can read Campaign Content from `woa-admin` through the server-to-server source boundary.

## Required configuration

Apply these values in each Cloudflare Workers environment that will read Campaign Content:

- `CAMPAIGN_CONTENT_SOURCE_BASE_URL` — the `woa-admin` origin for the same environment, for example `https://woa-admin.worldofaletheia.com`.
- `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET` — shared HMAC secret known only to `worldofaletheia.com` and `woa-admin` for that environment.
- `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE` — optional; defaults to `woa-admin:campaign-content-source:v1` and should only differ if the matching `woa-admin` environment expects a different audience.

## Setup steps

1. Generate a high-entropy secret per environment and store the same value in the matching `woa-admin` environment.
2. Set the main-site secrets with Wrangler or the Cloudflare dashboard. Use `--env staging` for staging and omit `--env` for production:

   ```bash
   pnpm wrangler secret put CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET
   pnpm wrangler secret put CAMPAIGN_CONTENT_SOURCE_BASE_URL
   ```

3. If `woa-admin` requires a non-default audience, set it as a non-secret environment variable or secret:

   ```bash
   pnpm wrangler secret put CAMPAIGN_CONTENT_RUNTIME_ASSERTION_AUDIENCE
   ```

4. Redeploy the main site after the variables are present.

## Verification

- Run `pnpm test src/lib/campaign-content-source-boundary.test.ts` to verify assertion payloads, headers, validation, and error mapping.
- Run `pnpm test src/lib/campaign-content-live-loader.test.ts` to verify the `campaignContent` live-loader list/detail filter mapping and access-scope propagation.
- In an environment wired to `woa-admin`, perform a campaign content read and verify `woa-admin` receives both `x-woa-runtime-assertion` and `x-woa-runtime-signature` headers.
- Decode the assertion payload only in a trusted operator context and confirm `exp - iat` is `60`, `campaignSlug` matches the requested campaign, and no email, display name, cookie, or session token appears in the payload.

## Rollback and recovery

- To stop source reads, remove or rotate `CAMPAIGN_CONTENT_RUNTIME_ASSERTION_SECRET` in either environment. Calls fail closed as unavailable.
- If a secret is exposed, rotate it in both `worldofaletheia.com` and `woa-admin`, then redeploy or restart both runtimes.
- If an environment points to the wrong `woa-admin` origin, correct `CAMPAIGN_CONTENT_SOURCE_BASE_URL` and redeploy before re-enabling Campaign Content routes.
