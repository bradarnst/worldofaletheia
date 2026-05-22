---
title: Use a D1-backed public spell read contract for the main site
status: accepted
date: 2026-05-11
decision-makers:
  - project owner
consulted:
  - architecture review
informed:
  - future maintainers
---
# Use a D1-backed public spell read contract for the main site
## Context and Problem Statement
The admin dashboard now has D1-backed canonical spell storage and improved operator search/filtering, but the main product goal is still better spell findability and organization on the public website.

The previous architecture direction treated the public site as a long-term consumer of exported spell artifacts only. That kept the boundary simple early on, but it is now creating tension with the actual product direction:

* spell search, filtering, and type-ahead are becoming first-class product capabilities on the public site
* the canonical data model has already evolved to support stable `spell_id` values and multi-value `spell_types`
* roughly one-third of spells still need correction work, and low-volume ongoing maintenance is expected afterward
* duplicating query semantics across admin workflows, export transforms, and public-site consumption would add accidental complexity

At the same time, the public site must remain read-only and should not couple directly to admin CRUD internals, route handlers, or operator-specific workflow assumptions.

## Decision Drivers
* improve public spell findability as a core product capability
* keep the admin repo as the only canonical write surface
* avoid duplicate search/filter logic and repeated data-shaping pipelines where possible
* preserve a clean boundary between canonical writes and public reads
* keep the main site read-only
* keep the first migration slice simple enough to fix forward or deploy-rollback without a second runtime data path
* fit the current Cloudflare-first deployment direction without over-designing for speculative portability
* defer heavier search infrastructure until simple indexed queries prove insufficient

## Considered Options
* Keep the public site on exported spell artifacts as the long-term primary model
* Let the public site read admin-oriented canonical tables and query paths directly from D1
* Use a D1-backed public spell read contract for the main site

## Decision Outcome
Chosen option: "Use a D1-backed public spell read contract for the main site", because it gives the product a shared query-driven spell platform without collapsing the boundary between admin writes and public reads.

The approved shape is:

* the admin dashboard remains the only write surface for spell data
* canonical spell storage remains in D1
* the main site reads through a documented, read-only public spell contract backed by D1
* the canonical public HTTP boundary for that contract is `https://worldofaletheia.com/api/v1/*`, even if the first implementation continues to live in the private admin repo
* the main site should use a server-side read adapter rather than embedding raw D1 access throughout page code
* the first rollout does not require an application-level export fallback path
* main-site/client-side implementation work should begin only after the canonical public routes are deployed and verified outside the admin-only hostname

This ADR supersedes the earlier planning assumption that the public site should remain an export-only consumer of spell data indefinitely.

A later cleanup pass accepted in ADR-0004 removed the temporary export, import, and migration artifacts that remained during the transition to the D1-backed public read model.

### Consequences
* Good, because admin and public spell features can converge on shared query semantics instead of maintaining parallel search/filter approaches.
* Good, because the public site can move toward better filtering, search, and type-ahead without waiting on a permanent export/import handoff model.
* Good, because the write boundary remains clear: admin writes canonical data, while the public site remains read-only.
* Good, because the migration can stay focused on a single real read path instead of maintaining two runtime paths at once.
* Good, because committing to `https://worldofaletheia.com/api/*` as the public boundary lets the project keep public client URLs stable even if the implementation later moves out of the admin repo.
* Bad, because the public site now becomes more runtime-aware than a purely static export model and will require explicit public error handling and cutover validation.
* Bad, because both repos now require coordinated migration work and a stable read-contract definition before main-site implementation can proceed safely.
* Bad, because portability away from Cloudflare becomes a deferred refactor concern rather than something designed up front.
* Neutral, because the public read contract may initially be implemented as a thin query layer over canonical tables, a projection, or views; the smallest sufficient boundary should be chosen during implementation.
* Neutral, because keeping the first public implementation in the private admin repo creates some planned structural refactor later if the public API is extracted into its own repo, but that refactor is expected to stay bounded if the public boundary remains explicit now.

### Confirmation
This decision is confirmed when all of the following are true:

* the public spell read contract is documented and testable
* the canonical public route namespace at `https://worldofaletheia.com/api/v1/*` is deployed and verified independently of the private admin hostname
* the main site reads spell data through that contract rather than artifact-only plumbing for the migrated surfaces
* staging proves that the main-site D1 read path delivers the required spell search/filter behavior without coupling to admin-only workflows

The decision should be revisited if one or more of the following occur:

* the main site does not actually need runtime-backed querying after the public read contract is implemented and tested
* the runtime/caching complexity materially outweighs the product benefit for the public spell experience
* the project leaves Cloudflare sooner than expected and the D1-backed read path becomes disproportionately expensive to port

## Pros and Cons of the Options
### Keep the public site on exported spell artifacts as the long-term primary model
A continued architecture where the public website consumes generated JSON artifacts as its main spell data source.

* Good, because it keeps deployment and failure behavior simple for a static-first site.
* Good, because it minimizes runtime coupling to D1.
* Neutral, because exports already exist and are deterministic.
* Bad, because it keeps the public spell experience on a separate long-term path from the query-driven capabilities now being built around canonical D1 data.
* Bad, because it encourages duplicated search/filter shaping logic across admin, export, and public-site layers.

### Let the public site read admin-oriented canonical tables and query paths directly from D1
A shared runtime model where the public site depends directly on admin-oriented tables or query handlers.

* Good, because it may appear to minimize upfront work.
* Good, because it allows direct reuse of some existing query logic.
* Bad, because it couples the public site to admin CRUD assumptions and makes future admin refactors riskier for public behavior.
* Bad, because it weakens the architectural boundary between write concerns and public read concerns.

### Use a D1-backed public spell read contract for the main site
A shared D1-backed platform where the public site reads a documented public contract directly, while exports may remain only as optional validation artifacts.

* Good, because it aligns architecture with the real product goal of better public spell findability.
* Good, because it keeps canonical writes and public reads distinct while still sharing a single backend platform.
* Neutral, because exports may still be kept for parity checks or operational convenience without becoming part of the runtime path.
* Neutral, because the exact implementation of the public read model can stay small and evolve from a thin layer if that is sufficient.
* Bad, because it requires deliberate contract, public error handling, and cutover decisions instead of leaving them implicit.

## More Information
Implementation guidance for this decision lives in:

* `docs/plans/d1-backed-spell-platform-plan-2026-05-11.md`
* `docs/plans/d1-backed-spell-platform-hld-2026-05-11.md`
* `docs/contracts/public-spell-read-api.openapi.yaml`
* `docs/contracts/public-spell-read-contract.md`

Main-site dependencies implied by this ADR:

1. document the public read contract before main-site integration work begins
2. deploy and verify the canonical public route namespace at `https://worldofaletheia.com/api/v1/*` before client-side/main-site implementation begins
3. add a main-site adapter around that contract and migrate list/filter/detail first
4. define public error behavior in the OpenAPI contract and keep the first rollout unauthenticated for spells
5. use parity checks where useful without requiring an application-level export fallback
6. defer FTS until measured needs justify it
