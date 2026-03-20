# Global Content Source Mode: Cloud-Default with Local Rollback Lane

## Status

- **Date:** 2026-03-20
- **Status:** Accepted
- **Deciders:** Brad

## Context

The project now has working capability for both local and cloud-backed content reads, including:

- runtime source-mode control (`local` vs `cloud`),
- R2 manifest-backed content contracts,
- cloud parity development lanes.

Related context:

- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`
- `plans/adrs/0001-obsidian-first-content-architecture.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/adrs/0009-campaign-content-source-separation-for-public-repo.md`

We are moving from technical feasibility to operational default policy.

## Decision Drivers

- Cloud-backed operation is already available and aligns with (Github) public-repo confidentiality goals.
- Canonical runtime behavior should be explicit and stable across environments.
- Minimize accidental complexity from mixed-source ambiguity.
- Preserve a practical rollback path for incidents.

## Considered Options

### Option 1: Local-default mode

Keep `CONTENT_SOURCE_MODE=local` as default and use cloud mode selectively.

**Pros**

- Lower immediate operational pressure.
- Familiar local-first behavior for contributors.

**Cons**

- Weakens production parity discipline.
- Delays convergence toward cloud-backed canonical flow.
- Increases risk of local-state masking cloud issues.

### Option 2: Cloud-default mode with explicit local rollback (Chosen)

Set cloud as canonical runtime mode and reserve local mode for explicit rollback or local authoring scenarios.

**Pros**

- Aligns runtime with target architecture.
- Improves parity between staging/production and cloud verification lane.
- Reduces ambiguity in debugging and operations.

**Cons**

- Requires stricter manifest/index operational discipline.
- Requires clear local fallback rules to avoid misuse.

### Option 3: Per-collection mixed mode by default

Let each collection independently choose local or cloud as standard operation.

**Pros**

- Flexible migration pacing.

**Cons**

- Highest cognitive and operational complexity.
- Harder to reason about parity and incident behavior.

## Decision Outcome

**Chosen option:** Option 2 - cloud-default mode with explicit local rollback lane.

### Policy

1. Canonical runtime default is `CONTENT_SOURCE_MODE=cloud` in authoritative lanes.
2. `CONTENT_SOURCE_MODE=local` remains available for local authoring workflows and incident rollback.
3. `CONTENT_SOURCE_OVERRIDES` remains emergency-only and must not become normal operation.
4. All collections are expected to support both source modes under one global switch.
5. Protected content remains deny-by-default on cloud fetch/parse/validation failure.

### Environment Expectations

- `pnpm dev`: local convenience lane; not authoritative for cloud parity.
- `pnpm dev:cf`: cloud parity lane and canonical verification path.
- staging/production: cloud mode canonical.

## Consequences

### Positive

- Clear operational default and reduced source ambiguity.
- Better consistency with cloud-backed content strategy.
- Stronger parity confidence for release behavior.

### Negative

- Increased reliance on manifest and sync correctness.
- More visible impact from cloud ingestion failures.

### Neutral

- Obsidian remains authoring source of truth.
- Astro-native route/content APIs remain the application read model.

## Acceptance Criteria

1. Cloud mode is documented as canonical runtime mode.
2. Local mode is documented as rollback/editorial lane, not primary production posture.
3. Core runbooks and handoff docs reference the same default/rollback semantics.
4. Protected-route failure behavior remains deny-by-default in cloud mode.

## Links

- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`
- `plans/adrs/0001-obsidian-first-content-architecture.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/adrs/0009-campaign-content-source-separation-for-public-repo.md`
