# Campaign Admin Better Auth Gate Fix Plan

## Goal

Make `/campaigns/[campaign]/admin` behave like a hard-coded `visibility: gm` Campaigns route and document that this repo does not use Cloudflare Access for auth.

## Implementation

1. Update `src/pages/campaigns/[campaign]/admin.astro`
   - Use the existing campaign access resolver/visibility semantics.
   - Treat the route as `visibility: gm`.
   - Do not render campaign title, excerpt, breadcrumbs, member data, or admin UI unless the actor is authenticated and is GM for that exact campaign.
   - Keep unauthenticated, forbidden, and unavailable states generic.

2. Keep API behavior aligned
   - Confirm campaign member APIs continue using Better Auth session plus `campaign_memberships.role = 'gm'`.
   - Do not add Cloudflare Access checks.

3. Update `AGENTS.md`
   - State that this repo uses Better Auth for authentication and D1 campaign memberships for authorization.
   - State that Cloudflare Access must not be used in site code, route protection, or campaign API authorization.
   - If Better Auth is ever suboptimal, document the concern and request architectural review instead of substituting Cloudflare Access.

## Verification

- Run targeted campaign access tests if available.
- Run `pnpm test`.
- Manually verify:
  - anonymous admin route shows no campaign-specific metadata
  - non-GM shows no campaign-specific metadata
  - correct campaign GM sees admin dashboard
