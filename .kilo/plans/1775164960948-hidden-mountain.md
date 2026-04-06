# Priority Weighing Plan: G1/G2 vs Next Work

## Goal
Choose the highest-value next work item with a brief, explicit weighting across current blockers, refactors, and feature work.

## Current Reality Check
- **Gate G1 is already closed** (taxonomy contract + grouped UX behavior documented and implemented).
- **Gate G2 is closed in current docs/code semantics**, but that closure is tied to a manifest-involved sync path.
- You have stated the immediate direction is **manifest removal** and moving `id/slug -> R2 key` ownership to D1.

## What “G1/G2 Closure” Would Entail (Brief)
### G1 (already done)
- type/subtype/tag query contract
- grouped vs latest view semantics
- empty/error/fallback behavior

### G2 (currently done, but about to be superseded)
- sync publish failure semantics + support codes
- fail-fast behavior for authoritative lane
- operator visibility/runbook behavior

Given the manifest-removal decision, a standalone new G1/G2 closure tranche has low value now.

## Weighted Comparison (1-5 scale)
Scoring model: `Priority = (Impact + Risk Reduction + Architectural Leverage + Urgency) - Effort`

| Candidate | Impact | Risk Red. | Arch Leverage | Urgency | Effort | Priority |
|---|---:|---:|---:|---:|---:|---:|
| Manifest retirement refactor (D1 key contract) | 5 | 5 | 5 | 5 | 4 | **16** |
| Campaign media variants completion (`thumb/detail/fullscreen`) | 4 | 3 | 3 | 4 | 3 | **11** |
| Calendar MVP extension | 3 | 2 | 2 | 3 | 3 | **7** |
| Wrangler/operator tooling hardening | 2 | 3 | 2 | 3 | 2 | **8** |
| Separate G1/G2 closure follow-up sprint | 1 | 1 | 1 | 1 | 2 | **2** |

## Recommendation
Do **not** schedule a separate “G1/G2 closure” sprint.

### Recommended order
1. **Manifest retirement refactor (next, highest value)**
2. **Campaign media variant pipeline completion**
3. **Calendar MVP extension**
4. **Operator tooling hardening**

## Immediate Execution Shape (for next implementation pass)
### Phase A — Define replacement contract
- Define D1-backed lookup contract for `collection + id/slug -> R2 key`.
- Confirm required fields/indices and stale reconciliation semantics without manifests.
- Keep deny-by-default behavior for protected content.

### Phase B — Dual-path transition
- Add D1 lookup path in cloud loader behind a feature flag or compatibility switch.
- Maintain manifest path temporarily for rollback while validating parity.
- Add focused tests for lookup correctness and missing-key behavior.

### Phase C — Manifest removal cutover
- Remove manifest generation/read paths once D1 lookup parity is proven.
- Simplify sync runtime and support-code surface.
- Update ADR/runbooks to remove manifest language and reduce doc drift.

## Exit Criteria for this sequence
- Cloud read path no longer depends on manifests.
- D1 is sole source for metadata + object lookup keys.
- Sync failure semantics remain fail-fast and operator-visible.
- Campaign media variant work proceeds on top of the simplified pipeline.
