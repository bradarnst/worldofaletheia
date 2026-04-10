# Campaign Membership Role Unification in `campaign_memberships`

## Status

- Date: 2026-04-09
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

Campaign authorization currently spans two D1 tables plus a local fallback split:

- `campaign_memberships` governs member access.
- `campaign_gm_assignments` governs GM-only access.
- local/dev fallback config mirrors the same split through `memberships` and `gmAssignments`.

That model now creates more accidental complexity than product value:

1. The same campaign relationship can exist in two places.
2. Operator workflows need separate membership and GM mutation paths.
3. Runtime authorization resolves `campaignMembers` and `gm` through different data sources even though both are campaign-role facts.
4. The repository already carries a `role` column on `campaign_memberships`, but the current production model does not treat that table as the canonical role authority.

Current repository signals show the system is already partway toward a unified role model:

- `migrations/0001_campaign_memberships.sql` already includes `role TEXT NOT NULL DEFAULT 'member'`.
- `scripts/operator-sql/templates/membership-grant.sql` and `scripts/operator-sql/templates/membership-role-update.sql` already operate on membership roles.
- `scripts/operator-sql/verify.sql` and `scripts/operator-sql/audit.sql` already report membership rows grouped by role.
- `migrations/0005_campaign_gm_assignments_multi.sql` already broadened GM assignment to allow multiple GMs per campaign, which also fits a role-per-membership model naturally.
- current request-time gating already resolves identity/session through Better Auth and then evaluates campaign entitlement in D1.

The Campaigns domain is the first interactive/authenticated domain in the product, so materially complex authorization rules are now concrete enough to justify tightening the data model. That still does not justify a new service or adapter layer: this remains a D1-backed, Astro-native authorization concern. This ADR changes only the entitlement model; Better Auth remains the authentication and session boundary.

## Decision Drivers

- Establish one canonical source of truth for campaign authorization relationships.
- Preserve current `visibility: public | campaignMembers | gm` semantics.
- Support multiple GMs per campaign without a second authority table.
- Reduce operator and runbook drift.
- Keep rollout and rollback low-risk for staging and production.
- Improve long-term Campaigns extraction readiness without introducing ACL over-engineering.

## Considered Options

### Option 1: Keep the dual-table model

Retain `campaign_memberships` for members and `campaign_gm_assignments` for GMs.

**Pros**

- No data-model migration required.
- Minimal near-term code churn.

**Cons**

- Continues split-brain authority for one domain concept.
- Keeps duplicated operator workflows and docs.
- Makes rollback and audit harder because authorization truth remains distributed.

### Option 2: Unify campaign roles in `campaign_memberships` (Chosen)

Treat each `(user_id, campaign_slug)` row as the full authorization fact, with `role` carrying `member` or `gm`.

**Pros**

- One row expresses the full relationship.
- `gm` naturally implies `campaignMembers` access.
- Multiple GMs per campaign remain supported with no extra table.
- Operator workflows collapse to one mutation surface.

**Cons**

- Requires staged migration and runbook updates.
- Requires short-term coexistence with the old GM table during cutover/burn-in.

### Option 3: Replace both tables with a generic ACL or permissions model

Introduce a broader authorization schema such as role bindings plus per-permission grants.

**Pros**

- Maximum future flexibility.

**Cons**

- Over-engineered for current product scope.
- Adds policy and migration complexity without a present requirement.

## Decision Outcome

**Chosen option:** Option 2 - unify campaign authorization roles in `campaign_memberships`.

### Policy

1. `campaign_memberships` becomes the canonical authorization table for campaign access.
2. Each `(user_id, campaign_slug)` pair has exactly one authoritative row.
3. Allowed role values are initially locked to `member` and `gm`.
4. Authorization semantics are:
   - `public` -> no membership row required
   - `campaignMembers` -> any row with role `member` or `gm`
   - `gm` -> row with role `gm`
5. `campaign_gm_assignments` becomes a temporary migration and rollback artifact only; it is not the long-term authority.
6. Staging and production operator workflows converge on membership-role upsert/revoke operations.
7. Local/dev fallback should also converge on one membership-role source and deprecate separate GM-only config/env inputs.
8. Better Auth identity and session handling remain unchanged; campaign entitlement continues to key off Better Auth `user.id`.
9. This decision does not change route structure, content frontmatter visibility values, or non-campaign informational markers such as `gmResource`.

## Consequences

### Positive

- Campaign authorization becomes easier to reason about and audit.
- Operator templates and runbooks can collapse to one primary assignment model.
- Multiple GMs per campaign remain supported without special handling.
- Campaign extraction readiness improves because the authz contract becomes simpler and more portable.

### Negative

- Migration sequencing must be handled carefully to avoid temporary drift.
- Existing runbooks, env docs, templates, and verification SQL need coordinated updates.
- Rollback after read-path cutover requires explicit repair or regeneration of the legacy GM table until it is dropped.

### Neutral

- This does not introduce repository/service/adapter layers beyond the existing D1-backed access seam.
- This does not change the Obsidian-first content flow under ADR-0001.
- This does not change Campaign route SSR behavior or the broader four-layer IA.

## Links

- `plans/option-3-unified-membership-role-upgrade-todo.md`
- `plans/campaign-membership-role-unification-migration-strategy-2026-04-09.md`
- `plans/campaign-permissions-phased-enhancement-plan.md`
- `plans/phase-2-1-better-auth-google-mailjet-email-implementation-plan.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
