---
title: External Admin Taxonomy Management Requirement
dateAdded: 2026-04-25
status: Open
priority: Medium
relatedFiles:
  - src/lib/content-types.ts
  - docs/content-ingestion-user-guide.md
  - docs/runbook/obsidian-content-sync-troubleshooting.md
---

# External Admin Taxonomy Management Requirement

## Why

Taxonomy changes such as adding, modifying, or deleting values in `src/lib/content-types.ts` are currently code-only privileged operations. They affect repository-wide schema validation, content-sync behavior, and build outcomes.

That is acceptable for the current small-team workflow, but it should eventually be part of a broader privileged admin/operator surface instead of remaining an undocumented or ad hoc code-only responsibility.

Per ADR-0021, that privileged surface is external to this repository by default. This todo remains open to preserve the requirement, but its implementation home is expected to be `woa-admin` or a related external operator-facing project.

## Deferred requirement

As part of a future **external admin** effort (specific architecture and design TBD), include a privileged taxonomy-management capability that can:

- add, modify, and delete allowed content type values
- clearly distinguish lower-risk additions from higher-risk renames/removals
- warn that type changes affect sync/build behavior across the site
- surface the required operator workflow (`build -> sync dry-run -> sync -> build`)
- gate the feature behind elevated privileges
- leave an audit-friendly trail of taxonomy changes

## Constraints

- Do not assume a specific implementation beyond external ownership by default.
- Do not plan an admin dashboard or CRUD surface inside this repository unless a later ADR explicitly changes the boundary.
- Keep the public site Astro-native and API/artifact-consuming rather than growing a privileged operator runtime here.
- Preserve a clear handoff contract: the external admin project should define validation, workflow guidance, privilege boundaries, and any audit expectations.

## Success criteria

- Future operators do not need to edit `src/lib/content-types.ts` blindly.
- Taxonomy changes become an explicit, privileged workflow with clear validation guidance.
- The external admin project treats taxonomy management as one requirement inside the larger privileged operations surface, not as a standalone one-off tool.

## Links

- `plans/adrs/0021-external-admin-capability-boundary.md`
