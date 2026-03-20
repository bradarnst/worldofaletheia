# Campaign Visibility & Access Control — Corrected Phase 2.1 + Phase 3 Implementation Plan

## Status

- **Date:** 2026-03-06
- **Status:**
  - Phase 1 implemented (policy + schema groundwork)
  - Phase 2.1 implemented (Better Auth + D1 + campaign GM enforcement model live in staging + production)
  - Phase 3 implemented for metadata separation (enforced campaign visibility vs informational canon GM marker)

## Why this update was required

The previous plan and implementation centered campaign protection on `visibility: public | campaignMembers` with optional GM-style tags as non-security metadata.

This created a gap for campaign-secret material: there was no canonical enforced GM-only access level.

This revision corrects that model and standardizes campaign protection to:

- **enforced** `visibility: public | campaignMembers | gm`
- **default visibility = `gm`** for campaign overview entries
- **default visibility = `campaignMembers`** for session entries

## Corrected target model

### 1) Campaign enforcement (security boundary)

For campaign-scoped entries (campaign overviews and sessions), authorization enforcement uses exactly one field:

- `visibility: 'public' | 'campaignMembers' | 'gm'`

Rules:

- `public` → visible to all
- `campaignMembers` → visible to campaign members and campaign GM
- `gm` → visible only to campaign GM

Default by content type:

- campaign overviews: `visibility` defaults to `gm`
- sessions: `visibility` defaults to `campaignMembers`

Precedence rule for session pages:

- session-level visibility is authoritative when explicitly set
- campaign-level visibility can only tighten an explicitly `public` session fallback
- campaign-level defaults must not rewrite an explicit session-level `campaignMembers` value

### 2) GM identity resolution (implemented now)

GM assignment is sourced from `config/campaign-access.config.json` via explicit mapping:

- `gmAssignments: { [campaignSlug]: { userId: string } }`

Runtime access checks read this mapping and compare against authenticated session user id.

Until a dashboard exists, this config file is the source of truth.

### 3) Canon/Using GM marker (informational only)

A separate marker is used for non-campaign discoverability and labeling:

- `gmResource: boolean`

This marker is **never** used in authorization decisions.

Legacy fields (`gm`, `gm-date`, `gm-info`) remain tolerated for transition and should be normalized toward `gmResource` over time.

## Implementation notes

### Enforced campaign model

- Campaign schemas support `public | campaignMembers | gm`
- Campaign `visibility` defaults to `gm`
- Session `visibility` defaults to `campaignMembers`
- Campaign route checks enforce `gm` and `campaignMembers` semantics
- Campaign member checks continue to use Better Auth session + D1 membership, with dev fallback only where explicitly enabled

### GM assignment config

`config/campaign-access.config.json` now includes:

- `memberships` map (existing)
- `gmAssignments` map (new)

### Backward compatibility

- Existing membership config shape preserved
- Legacy metadata fields tolerated for transition
- Access enforcement remains centralized through campaign access resolver seam

## Guardrails

1. Campaign protection is enforced only by campaign `visibility` + campaign GM/membership resolution.
2. Canon/Using GM marker (`gmResource`) remains informational only.
3. `secret` and `permissions` are not authorization gates.
4. Default visibility policy is asymmetric by content type (`gm` for campaigns, `campaignMembers` for sessions).

## Validation expectations

1. Campaign entries without explicit `visibility` resolve to `gm`.
2. Session entries without explicit `visibility` resolve to `campaignMembers`.
3. Explicit session `campaignMembers` visibility is not overwritten by campaign default `gm`.
4. Non-GM users are denied `gm` campaign content.
5. Campaign members (and GM) can access `campaignMembers` content.
6. `gmResource` in non-campaign content does not alter auth behavior.

## Related references

- `src/content.config.ts`
- `src/utils/campaign-access.ts`
- `src/utils/campaign-membership-config.ts`
- `config/campaign-access.config.json`
- `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`
- `docs/runbook/campaign-access-local-dev.md`
