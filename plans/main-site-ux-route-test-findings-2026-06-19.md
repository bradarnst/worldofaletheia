# Main-Site UX Route Test Findings

Date: 2026-06-19
Status: Partial execution recorded; staging browser/account lanes still need operator access
Source plan: `plans/main-site-ux-route-test-plan-2026-06-19.md`

## Execution Context

- Local lane used `pnpm dev:cf:auth` after preparing local D1/R2 content state.
- Remote publication checks used `pnpm content:sync:staging:dry-run`, `pnpm content:sync:prod:dry-run`, and read-only D1 queries.
- No Cloudflare Access checks, campaign member mutation endpoints, spell authority work, taxonomy admin work, or live-note implementation were introduced.

## Fixes Applied During Triage

### Local parity startup order

Finding:

- `pnpm dev:cf:auth` failed when the local D1 schema was missing the publication metadata columns because the script built the Cloudflare bundle before running local migrations.

Fix:

- Updated `package.json` so `dev:cf:auth` runs `pnpm content:sync:local` before `pnpm dev:cf:build` and `pnpm dev:cf`.
- This prepares local D1/R2 content state before the cloud content loader queries `content_index` during build.

Verification:

- Restarted `pnpm dev:cf:auth`; local server reached ready state on port 8787.

### Campaign family missing-entry response

Finding:

- Direct production checks for the preview-only Benoit Laclisse campaign-character URL currently return HTTP 500 before deployment of this fix, because missing campaign family entries threw during route rendering.

Fix:

- Updated `src/pages/campaigns/[campaign]/[family]/[...slug].astro` to return HTTP 404 with noindex fallback copy when the campaign or family entry is absent in the current publication environment.

Verification:

- Local `http://127.0.0.1:8787/campaigns/barry/characters/not-a-real-entry` returns HTTP 404 and renders `Campaign content not found` copy.
- `pnpm build` passes after the route change.

## Local Route Smoke Results

| Route | Result | Notes |
| --- | --- | --- |
| `/` | Pass | HTTP 200. |
| `/login` | Pass | HTTP 200; sign-in, sign-up, and forgot-password entry copy present. |
| `/forgot-password` | Pass | HTTP 200. |
| `/reset-password` | Pass | HTTP 200; invalid/missing token path renders reset-link warning state. |
| `/contact` | Pass | HTTP 200; form route renders. |
| `/contribute` | Pass | HTTP 200; guidance and form route render. |
| `/campaigns` | Pass | HTTP 200; campaign tools/navigation entry copy present. |
| `/campaigns/brad` | Pass | HTTP 200. |
| `/campaigns/brad/admin` | Pass, auth controls unverified | HTTP 200; anonymous page includes sign-in-required/admin capability loading surfaces. |
| `/lore` | Pass | HTTP 200. |
| `/places` | Pass | HTTP 200. |
| `/search` | Pass | HTTP 200. |
| `/campaigns/barry/characters/not-a-real-entry` | Pass after fix | HTTP 404 fallback instead of server error. |

## Local Form/Auth POST Results

| Area | Result | Notes |
| --- | --- | --- |
| Auth pages | Partially blocked | Static auth entry pages render. POST flows return `authentication_unavailable` in this local environment because required secret env values are not available in the tracked Wrangler vars. This needs `.dev.vars`/operator env setup for full account-flow testing. |
| Cross-site protection | Pass/expected | POSTs without origin headers were rejected with `Cross-site POST form submissions are forbidden`. |
| Contact invalid payload | Pass | Astro action returns validation error response. |
| Contribute invalid payload | Pass | Astro action returns validation error response. |
| Contact valid payload | Partially blocked/expected without Mailjet secrets | Local valid submission returns service-unavailable behavior without Mailjet credentials. Browser UX still needs manual verification with staging Mailjet sandbox env. |

## Remote Publication Checks

| Check | Result |
| --- | --- |
| `pnpm content:sync:staging:dry-run` | Pass: `0 new, 0 updated, 0 stale, 216 unchanged`. |
| `pnpm content:sync:prod:dry-run` | Pass: `0 new, 0 updated, 0 stale, 215 unchanged, 1 publication-excluded`; excluded `cloud://barry/characters/Benoit Laclisse.md`. |
| Staging D1 publication rows | Pass: `preview = 1`, `publish = 104`. |
| Staging D1 R2 prefix | Pass: `0` rows outside `content/staging/...`. |
| Production D1 publication rows | Pass: `publish = 104`; no preview rows. |
| Production D1 R2 prefix | Pass: `0` rows using `content/staging/...`; `0` rows outside `content/...`. |
| Staging route URL | Blocked | `https://staging.worldofaletheia.com` does not resolve from this environment; use the active Cloudflare Pages preview/staging URL for manual verification. |
| Production preview-only direct URL | Fixed in source; deployed | Earlier deployed production returned HTTP 500 for guessed preview-only routes before the 404 fix. Owner reports the current deployment no longer has this active 500 thread; retain this row as historical context unless a fresh check reproduces the failure. |

## Follow-up Verification on 2026-06-20

- `pnpm content:sync:staging:dry-run` still passes: `0 new, 0 updated, 0 stale, 216 unchanged`.
- `pnpm content:sync:prod:dry-run` still passes with the expected exclusion: `0 new, 0 updated, 0 stale, 215 unchanged, 1 publication-excluded`; excluded `cloud://barry/characters/Benoit Laclisse.md`.
- Staging D1 still contains the preview-only row: `collection = campaignCharacters`, `campaign_slug = barry`, `slug = Benoit Laclisse`, `r2_key = content/staging/campaigns/barry/characters/Benoit Laclisse.md`.
- Production D1 still contains only `publication = publish` rows (`104`) and no preview rows.
- `pnpm build` passes with the existing content-loader missing-directory warnings and dynamic-route `getStaticPaths()` warnings.
- Production route verification is still deploy-blocked/pending: `https://worldofaletheia.com/campaigns/barry/characters/Benoit%20Laclisse`, `https://worldofaletheia.com/campaigns/barry/characters/benoit-laclisse`, and `https://worldofaletheia.com/campaigns/barry/characters/not-a-real-entry` returned HTTP 500 from the deployed site at verification time. This means commit `349499a` is not yet observable on production or production is still serving behavior equivalent to the pre-fix route.

## Post-deploy Status on 2026-06-20

- Owner reports the relevant migrations, build, and deployment have completed.
- Owner reports the earlier production HTTP 500 route thread is not current. Treat the HTTP 500 notes above as historical verification context unless a fresh production check reproduces the failure.
- Remaining main-site UX route lanes are manual/operator verification work, not active source implementation blockers.

## Remaining Manual Lanes

- Use real local `.dev.vars` or operator-provided staging env to complete email/password sign-up, sign-in, sign-out, and password reset flows.
- Use a known test account matrix to verify anonymous, non-member, member, and GM campaign-management behavior.
- Use the active Cloudflare Pages staging/preview hostname to verify preview-only Benoit Laclisse route resolution.
- Verify contact/contribute success behavior in staging with Mailjet sandbox credentials.
- Visually inspect content-state badges, GM-spoiler label-only copy, author chips, and detail-header notices on pages with matching content metadata.

## Triage Policy Used

- Production HTTP 500s from public routes are blockers unless proven non-public or already fixed before deploy.
- Missing local operator secrets block account-flow execution but are not production blockers by themselves.
- Mailjet success-path testing is staging/operator-env work; local service-unavailable behavior is acceptable when secrets are absent.
- Staging DNS/hostname unavailability is an environment blocker, not an in-repo implementation task.
