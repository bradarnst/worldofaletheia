# Main-Site UX Route Test Plan

Date: 2026-06-19
Status: Proposed manual/route-level test scripts

## Scope

These scripts cover the post-publication-metadata main-site UX checks: campaign user-management entry behavior, auth/password flows, contact/contribute forms, publication badges and warnings, and staging-vs-production publication expectations.

## Test lanes

- **Local Cloudflare parity:** `pnpm dev:cf:auth`
- **Staging/preview:** Cloudflare staging deployment with staging D1/R2 content target.
- **Production:** `https://worldofaletheia.com` with production D1/R2 content target.

## 1. Auth and password flows

### Sign up

1. Open `/signup` or the site sign-up entry route.
2. Submit invalid email and short password.
3. Verify inline validation and no account creation.
4. Submit a valid test email/password.
5. Verify account creation flow, email behavior, and post-auth redirect.

### Sign in/sign out

1. Open `/login`.
2. Submit wrong password for a known test account.
3. Verify safe error text without account enumeration.
4. Submit correct credentials.
5. Verify authenticated navigation/session behavior.
6. Sign out and verify protected campaign surfaces no longer render authenticated controls.

### Password reset

1. Open password reset request route.
2. Submit malformed email.
3. Submit known and unknown well-formed emails.
4. Verify responses do not reveal account existence.
5. Follow a valid reset link in staging/local.
6. Set a new password and verify login with the new credential.

## 2. Contact and contribute forms

### Contact

1. Open `/contact`.
2. Submit empty form and verify field-level validation.
3. Submit malformed email.
4. Submit valid message in staging with Mailjet sandbox behavior.
5. Verify success message and no duplicate submission on refresh/back.
6. Simulate or inspect failure behavior where practical; verify graceful error copy.

### Contribute

1. Open `/contribute`.
2. Verify expected guidance and external-boundary wording.
3. Submit invalid and valid form payloads.
4. Verify validation, success, and failure states match contact-form behavior.

## 3. Campaign user-management entry behavior

This repo must not implement campaign member mutation endpoints directly. Test only main-site entry and consumption behavior.

1. As anonymous user, open a campaign route and verify no admin/member-management controls are visible.
2. As non-member, open a campaign route and verify protected content remains denied or limited according to campaign visibility.
3. As member, verify member-only content renders when authorized and no GM-only management controls appear.
4. As GM, verify any campaign-management entry point links only to approved front-end/API consumer surfaces and does not expose raw D1 mutation behavior.
5. Verify all campaign authz checks use the exact campaign slug, not fuzzy title/display-name matching.

## 4. Publication badges and warnings

### Content cards

1. Open a listing page with published content, such as `/lore`, `/places`, or `/campaigns`.
2. Verify `contentState: stable` is visually silent.
3. Verify `contentState: unfinished` or `mayChange`, where present, displays as a non-authorizing content-state badge.
4. Verify `audienceWarnings: [gmSpoilers]`, where present, displays label-only copy and does not imply privacy/access control.
5. Verify author chips render on non-campaign and campaign cards when `authors` exists.

### Detail pages

1. Open a content detail page with publication metadata.
2. Verify detail header notices appear below title/summary.
3. Verify GM-spoiler warning copy is label-only.
4. Verify breadcrumbs render when `parentChain` is non-empty.
5. Verify relationship links render under the shared article header.

## 5. Preview vs production publication expectations

### Staging/preview lane

1. Run `pnpm content:sync:staging:dry-run` and verify it reports no pending changes after sync.
2. Verify staging D1 contains both `publish` and `preview` rows.
3. Open the known preview-only Benoit Laclisse character route in staging and verify it resolves.
4. Verify staging D1 `r2_key` values use the `content/staging/...` target prefix.

### Production lane

1. Run `pnpm content:sync:prod:dry-run` and verify it reports no pending changes except the expected `publication-excluded` preview source.
2. Verify production D1 has `0` `publication = 'preview'` rows.
3. Search/listing pages must not show preview-only content.
4. Direct preview-only content URL should not resolve as public production content.
5. Verify production D1 `r2_key` values use the `content/...` target prefix and not `content/staging/...`.

## Exit criteria

- All high-risk auth, form, campaign access, publication, and route-lane expectations pass in staging before production verification.
- Any failed production expectation becomes a blocker unless it is explicitly documented as non-production-impacting.
- No new Cloudflare Access, in-repo admin mutation, or live-note editing behavior is introduced while executing this plan.
