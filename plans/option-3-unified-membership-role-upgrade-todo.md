# Option 3 TODO — Unified Membership + GM Roles (High-Level Upgrade Plan)

## Status

- Status: ADR accepted and code handoff drafted on 2026-04-09
- ADR: `plans/adrs/0019-campaign-membership-role-unification.md`
- Migration strategy: `plans/campaign-membership-role-unification-migration-strategy-2026-04-09.md`
- Code handoff: `plans/campaign-membership-role-unification-lld-handoff-2026-04-09.md`

## Context

Option 3 consolidates campaign authorization into a single table model:

- one source of truth: `campaign_memberships`
- role-driven authorization: `member` and `gm` (extensible later)
- remove dedicated `campaign_gm_assignments` table after migration completion

This is a post-stabilization simplification, not a launch blocker.

## High-Level Design

- Keep `campaign_memberships(user_id, campaign_slug, role, created_at, updated_at)` as canonical authz table.
- `gm` becomes a role value, not a separate relation.
- Access resolver checks:
  - `campaignMembers`: any role in `member|gm`
  - `gm`: role == `gm`
- Remove GM config/env authority from staging/prod paths.

## Upgrade TODO

- [x] Draft ADR and migration strategy for unified role model (Option 3), including migration and rollback policy.
- [ ] Add or confirm role constraints in schema (`role IN ('member','gm')`) and future extension policy.
- [ ] Backfill existing GM assignments into `campaign_memberships` as `role='gm'`.
- [x] Define conflict policy when `member` and `gm` rows overlap (`gm` wins for the unified row).
- [ ] Update runtime authorization to query only `campaign_memberships`.
- [ ] Remove runtime reads of `campaign_gm_assignments` and GM config/env in staging/prod.
- [ ] Deprecate GM operator templates; replace with membership role upsert/revoke templates.
- [ ] Update runbook SOP and verification queries for role-based checks.
- [ ] Add tests for role precedence (`gm` implies campaignMembers access).
- [ ] Execute staged rollout: staging migration + verification, then production rollout.
- [ ] After burn-in, drop `campaign_gm_assignments` with a one-way migration.
- [ ] Clean docs/plans references to dual-table model.

## Rollout Strategy

### Phase A — Preflight + constrained backfill

- Freeze GM operator mutations during cutover.
- Rebuild `campaign_memberships` with a role constraint and backfill `campaign_gm_assignments` rows as `role='gm'`.
- Keep `campaign_gm_assignments` temporarily for rollback/parity checks only.

### Phase B — Single-read switch

- Switch resolver to read only role-based memberships.
- Validate authorization behavior across visibility levels.

### Phase C — Burn-in + decommission

- Run parity verification between legacy GM rows and `campaign_memberships WHERE role='gm'`.
- Remove GM-assignment table and related templates after burn-in.
- Finalize docs and remove fallback references.

## Done Criteria

- [ ] Production authorization decisions rely on one table only.
- [ ] Operator workflow uses one assignment model only.
- [ ] Runbook and templates are consistent with runtime behavior.
- [ ] No non-local GM authority path remains outside membership roles.
