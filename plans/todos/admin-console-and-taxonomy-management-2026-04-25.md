---
title: Future Admin Console and Taxonomy Management
dateAdded: 2026-04-25
status: Open
priority: Medium
relatedFiles:
  - src/lib/content-types.ts
  - docs/content-ingestion-user-guide.md
  - docs/runbook/obsidian-content-sync-troubleshooting.md
---

# Future Admin Console and Taxonomy Management

## Why

Taxonomy changes such as adding, modifying, or deleting values in `src/lib/content-types.ts` are currently code-only privileged operations. They affect repository-wide schema validation, content-sync behavior, and build outcomes.

That is acceptable for the current small-team workflow, but it should eventually be part of a broader admin/operator surface instead of remaining an undocumented or ad hoc code-only responsibility.

## Deferred requirement

As part of a future **admin console** effort (specific architecture and design TBD), include a privileged taxonomy-management capability that can:

- add, modify, and delete allowed content type values
- clearly distinguish lower-risk additions from higher-risk renames/removals
- warn that type changes affect sync/build behavior across the site
- surface the required operator workflow (`build -> sync dry-run -> sync -> build`)
- gate the feature behind elevated privileges
- leave an audit-friendly trail of taxonomy changes

## Constraints

- Do not assume a specific admin-console architecture yet.
- Keep Astro-native/static-first principles in mind until a real privileged runtime surface is justified.
- Avoid inventing abstractions before the broader admin-console shape is decided.

## Success criteria

- Future operators do not need to edit `src/lib/content-types.ts` blindly.
- Taxonomy changes become an explicit, privileged workflow with clear validation guidance.
- The admin-console project treats taxonomy management as one requirement inside the larger privileged operations surface, not as a standalone one-off tool.
