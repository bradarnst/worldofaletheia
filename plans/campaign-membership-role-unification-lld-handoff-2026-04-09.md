# Campaign Membership Role Unification - LLD Handoff (2026-04-09)

## Status

- Date: 2026-04-09
- Audience: Code implementation handoff
- Related ADR: `plans/adrs/0019-campaign-membership-role-unification.md`
- Related migration strategy: `plans/campaign-membership-role-unification-migration-strategy-2026-04-09.md`
- Scope: Incremental authz simplification with staged migration and decommission

## Implementation Intent

Implement the accepted single-table authorization model for Campaigns while preserving the existing auth/session architecture.

The critical guardrail is explicit:

- Better Auth remains the identity and session boundary.
- The implementation must continue to key campaign authorization off `session.user.id` returned by Better Auth.
- This tranche changes only the D1 entitlement model and the local/dev fallback shape.
- Do not redesign Better Auth tables, OAuth callbacks, or session plumbing as part of this work.

## Existing Request-Time Boundary That Must Stay Intact

Current request flow already has the right separation of concerns:

1. campaign route receives request
2. resolver obtains Better Auth session from request context
3. authorization checks use D1 campaign entitlement data
4. policy applies `public | campaignMembers | gm`

That means the implementation should preserve:

- `getRequestSession(request, locals)` as the session source
- `session.user.id` as the D1 foreign-key identity
- deny-by-default behavior when entitlement lookup fails
- SSR request-time gating in campaign routes

## Current Problem to Remove

Today the authenticated path is split:

- member access -> `campaign_memberships`
- GM access -> `campaign_gm_assignments`

The code reflects that split directly:

- `src/utils/campaign-access.ts` asks the repo for both `isUserMemberOfCampaign()` and `isUserGmOfCampaign()`
- `src/lib/campaign-membership-repo.ts` reads different tables for those answers
- local fallback config and env also split membership and GM authority

The target implementation removes that split while leaving the Better Auth boundary untouched.

## Target Runtime Semantics

### Authorization rules

- `public` -> allow without entitlement lookup
- `campaignMembers` -> allow when a `campaign_memberships` row exists with role `member` or `gm`
- `gm` -> allow only when a `campaign_memberships` row exists with role `gm`

### Identity rule

All D1 authorization queries continue to use Better Auth `session.user.id` with no alternate identity mapping layer.

## File-by-File Delivery Plan

### 1) Migration layer

#### Add `migrations/0009_campaign_memberships_role_unification.sql`

Purpose:

- rebuild `campaign_memberships` with explicit role constraint
- backfill `campaign_gm_assignments` rows into `campaign_memberships`
- preserve rollback/parity by keeping `campaign_gm_assignments` in place for one burn-in window

Required behavior:

1. Create `campaign_memberships_next` with:
   - same columns as existing table
   - `CHECK (role IN ('member', 'gm'))`
   - `UNIQUE(user_id, campaign_slug)`
   - supporting campaign/user indexes recreated
2. Copy valid existing membership rows into the replacement table.
3. Upsert all legacy GM assignments into the replacement table as `role = 'gm'`.
4. Apply conflict rule:
   - if membership row and GM assignment overlap, resulting role is `gm`
5. Preserve existing row `id` when available.
6. Use deterministic id for GM-only backfilled rows.
7. Replace old `campaign_memberships` table.

Implementation note:

- Fail the migration if any existing role is outside `member|gm`.
- Do not drop `campaign_gm_assignments` in this migration.

#### Add `migrations/0010_drop_campaign_gm_assignments.sql`

Purpose:

- remove legacy GM table only after runtime cutover and burn-in validation complete

This migration is one-way and must not be included in the first rollout.

### 2) Migration runner

#### Edit `scripts/db-migrate-auth-plan.mjs`

Required changes:

- include `0009_campaign_memberships_role_unification.sql` in ordered migrations
- do not include `0010_drop_campaign_gm_assignments.sql` until burn-in is explicitly approved, or gate it behind an intentional later release step
- add preflight/conflict detection for invalid `campaign_memberships.role` values

Guardrail:

- No Better Auth schema changes should be bundled into this work unless a separate verified issue is found.

### 3) Repository layer

#### Edit `src/lib/campaign-membership-repo.ts`

Required behavior changes:

- `isUserMemberOfCampaign(userId, campaignSlug)` should query `campaign_memberships` and treat role `member|gm` as true
- `isUserGmOfCampaign(userId, campaignSlug)` should query `campaign_memberships` and treat role `gm` as true
- `listCampaignGms(campaignSlug)` should query `campaign_memberships WHERE role = 'gm'`
- return shapes may stay simple booleans/arrays; no new abstraction layer is needed

Suggested query shape:

```sql
SELECT 1
FROM campaign_memberships
WHERE user_id = ?1
  AND campaign_slug = ?2
  AND role IN ('member', 'gm')
LIMIT 1;
```

```sql
SELECT 1
FROM campaign_memberships
WHERE user_id = ?1
  AND campaign_slug = ?2
  AND role = 'gm'
LIMIT 1;
```

Important:

- `userId` remains the Better Auth `user.id`
- do not add a new user-identity translation layer

### 4) Authorization layer

#### Edit `src/utils/campaign-access.ts`

Required changes in `createCampaignAccessResolverFromRequest(...)`:

- preserve `getRequestSession(request, locals)` as-is
- preserve deny-by-default on missing session
- preserve deny-by-default on D1 failure when fallback is disabled
- remove the runtime dependency on `campaign_gm_assignments`
- continue returning `{ isMember, isGm }`, but derive both from `campaign_memberships`

Implementation note that must stay explicit in code comments or nearby docs:

- Better Auth session resolution happens first.
- Authorization then evaluates campaign entitlement keyed by `session.user.id`.
- This decision changes only entitlement storage, not authentication.

### 5) Local/dev fallback config

#### Edit `src/utils/campaign-membership-config.ts`
#### Edit `config/campaign-access.config.json`

Target direction:

- deprecate separate `gmAssignments`
- move to one membership-role config source for fallback use

Recommended fallback shape:

```json
{
  "memberships": {
    "brad": {
      "campaigns": {
        "brad": "gm",
        "barry": "member"
      }
    }
  }
}
```

Compatibility recommendation:

- accept old fallback shape for one transition window if needed
- normalize old `gmAssignments` into membership role `gm`
- document staging/prod as D1-only authority; fallback remains localhost-only

### 6) Operator SQL templates

#### Keep active

- `scripts/operator-sql/templates/membership-grant.sql`
- `scripts/operator-sql/templates/membership-role-update.sql`
- `scripts/operator-sql/templates/membership-revoke.sql`

#### Deprecate after burn-in

- `scripts/operator-sql/templates/gm-assignment-upsert.sql`
- `scripts/operator-sql/templates/gm-assignment-revoke.sql`

Required template behavior:

- `membership-grant.sql` should be the primary upsert path for both `member` and `gm`
- operators should not need a separate GM table mutation once runtime cutover is complete

### 7) Verification and audit SQL

#### Edit `scripts/operator-sql/verify.sql`

After runtime cutover, make `campaign_memberships` the primary authority in verification output:

- total membership rows
- counts by role
- rows by campaign/user/role
- optional parity comparison against `campaign_gm_assignments` during burn-in only

#### Edit `scripts/operator-sql/audit.sql`

Required updates:

- audit role distribution in `campaign_memberships`
- during burn-in, detect mismatch between `campaign_gm_assignments` and `campaign_memberships WHERE role = 'gm'`
- after decommission, remove GM-table-specific checks entirely

### 8) Runbooks and planning docs

#### Edit `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`

Must state clearly:

- Better Auth remains the auth/session boundary
- `campaign_memberships` is the sole staging/prod entitlement authority after cutover
- `campaign_gm_assignments` is legacy during burn-in only, then removed
- `CAMPAIGN_GM_ASSIGNMENTS` is not a non-local authority path

#### Edit `docs/runbook/campaign-access-local-dev.md`

Must state clearly:

- local cookie-map fallback remains non-authoritative and local-only
- fallback config now prefers one role-based membership map
- Better Auth parity lane remains the authoritative validation path for auth/session behavior

## Rollout Sequence

### Release 1

1. ship `0009_campaign_memberships_role_unification.sql`
2. update repo queries to unified membership-role reads
3. update resolver logic to use only unified membership-role reads
4. update templates/runbooks/verification for burn-in mode
5. validate staging, then production

### Burn-in window

1. compare `campaign_gm_assignments` with `campaign_memberships WHERE role = 'gm'`
2. verify no drift during real operator use
3. stop using GM-assignment templates operationally

### Release 2

1. ship `0010_drop_campaign_gm_assignments.sql`
2. remove GM parity checks
3. remove deprecated GM-only fallback references and templates from active SOP

## Test Plan

### Unit tests

Update or add tests covering:

1. `campaignMembers` allows `member`
2. `campaignMembers` allows `gm`
3. `gm` denies plain `member`
4. `gm` allows `gm`
5. missing Better Auth session denies
6. D1 failure with fallback disabled denies
7. fallback path still behaves as documented when explicitly enabled locally

### Integration expectations

1. authenticated user with `role='member'` can access `campaignMembers`
2. authenticated user with `role='gm'` can access both `campaignMembers` and `gm`
3. authenticated user with no row is denied
4. Better Auth session plumbing remains unchanged across the rollout

## Acceptance Criteria

1. Better Auth session handling is unchanged by this tranche.
2. All campaign entitlement checks key off Better Auth `session.user.id`.
3. Runtime reads no longer require `campaign_gm_assignments` after Release 1.
4. Operator workflow uses membership-role upsert/revoke as the active model.
5. After burn-in, `campaign_gm_assignments` can be dropped with no authz regression.

## Risks and Mitigations

- Migration drift during overlap: mitigate with explicit burn-in parity queries.
- Hidden identity mismatch: mitigate by keeping Better Auth `user.id` as the only entitlement key.
- Local fallback confusion: mitigate by clearly documenting fallback as local-only and non-authoritative.
- Overscoping into auth redesign: mitigate by treating Better Auth plumbing as frozen for this tranche.
