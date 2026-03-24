# Status Report Addendum: Campaign Content Model Refactor

- **Date:** 2026-03-24
- **Time:** 2026-03-24T18:27:10+01:00
- **Related status report:** `docs/status-report-2026-03-24.md`

## Purpose

This addendum records architectural guidance for a potential campaign content model refactor that was raised immediately after the 2026-03-24 status report.

## Context

Current modeling treats campaign content primarily through `campaigns` and `sessions` collections, with campaign subdomain semantics often expressed in `type` values and route/file hierarchy.

As campaign content grows (currently exploratory, expected to increase materially in ~6-8 weeks), this can create structural mismatch:

- collection level does not represent campaign content families consistently
- `type`/`subtype` semantics can drift from Canon and Using Aletheia patterns
- future extraction of Campaigns domain can become harder if taxonomy remains overloaded

## Importance and Priority Ranking

Given current project state, this refactor is ranked:

- **Importance:** High
- **Urgency:** Medium (time-sensitive before campaign expansion)
- **Priority position:** #3 overall

Current recommended ordering remains:

1. Discovery Gate G1/G2 closure and sync hardening
2. Campaign media variants pipeline completion
3. Campaign content model refactor (this item)
4. Calendar implementation kickoff
5. Option 3 authz role unification

## Recommendation

Proceed with this refactor soon, but sequence it after items #1 and #2 so operational and discovery foundations are stable first.

Rationale:

- campaign content expansion is near-term and will otherwise multiply migration cost
- current campaign work is still early enough to refactor with bounded disruption
- this improves consistency of collection/type/subtype behavior across domains

## Target Modeling Direction

Use **campaign-domain collections by content family**, while preserving campaign slug as a first-class field and path segment.

Illustrative collection set:

- `campaigns` (campaign overview/metadata)
- `sessions`
- `campaignLore`
- `campaignFactions`
- `campaignCharacters`
- `campaignScenes`
- `campaignAdventures`
- `campaignHooks`

Notes:

- initial schemas can mirror canonical equivalents where appropriate (for example, `campaignLore` aligns with `lore` initially)
- divergence is allowed later without schema contortions
- route policy remains Campaigns-domain gated and SSR/fail-closed where required

## Expected Impact

### Likely required changes

- `src/content.config.ts` (collection definitions and schema wiring)
- `scripts/content-sync/manifests.mjs` (campaign manifest derivation)
- `scripts/content-sync/content-index-writer.mjs` (index writing/filter rules)
- `src/pages/campaigns/**` (collection-specific routes and listing/detail pages)
- docs/runbooks and indexing tests/contracts

### Likely unchanged

- D1 table schema (no mandatory table migration expected)
- core auth/session tables
- deny-by-default authorization semantics

## ADR Timing Recommendation

Create the ADR **now as Proposed**, then move to **Accepted** after #1 and #2 complete.

Why this timing is preferred:

- captures intent and scope before additional exploratory content accumulates
- prevents drift in campaign authoring conventions during the next 2-4 weeks
- avoids starting implementation while foundational work still has active risk

Suggested ADR title:

- `Campaign Domain Collection Taxonomy Refactor` (next ADR number after current latest)

## Implementation Window Recommendation

- **Planning/design window:** immediate
- **Implementation start:** immediately after #1 and #2 completion
- **Execution shape:** one bounded migration tranche, followed by calendar kickoff

## Guardrails

- keep Astro-native data access (`getCollection`, `getEntry`, `render`) and avoid new service layers unless ADR-0004 triggers are concretely met
- preserve Campaigns as the only interactive domain
- preserve Obsidian-first, one-way content flow and content-sync source-of-truth rules

## Decision Record

As of this addendum date:

- recommendation is to proceed with refactor planning now
- implementation is intentionally deferred until priority items #1 and #2 are completed
- ADR should be drafted now (Proposed), not accepted yet
