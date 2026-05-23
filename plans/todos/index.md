---
title: Planning Todos Index
dateAdded: 2026-04-10
---

# Planning Todos

This folder is the canonical place for deferred implementation todos that need enough context to resume later.

## Conventions

- Each todo should live in its own markdown file under `plans/todos/`.
- Include frontmatter with at least `title` and `dateAdded`.
- Recommended extra fields: `status`, `priority`, and `relatedFiles`.

## Open Todos

| Title | Date Added | Status | Notes |
| --- | --- | --- | --- |
| [Breadcrumb Restoration as Deferred Navigation UX Work](./breadcrumb-restoration-navigation-ux-2026-05-08.md) | 2026-05-08 | Open | Tracks restoring expected breadcrumb navigation as a separate shared UX/navigation task rather than bundling it into sorcerer spells or admin-dashboard work. |
| [External Admin Taxonomy Management Requirement](./admin-console-and-taxonomy-management-2026-04-25.md) | 2026-04-25 | Open | Tracks taxonomy management as an external-admin requirement with workflow guidance and safeguards instead of an in-repo admin console. |
| [Future Related Resource Enrichment and Spell Discovery](./related-resource-enrichment-and-spell-discovery-2026-04-27.md) | 2026-04-27 | Open | Tracks a low-priority path from manual promoted-resource UX experiments toward incremental related-resource enrichment and eventual external spell-search/public-consumption integration. |

## Completed Todos

| Title | Date Added | Status | Notes |
| --- | --- | --- | --- |
| [Campaign ID Parsing Hardening](./campaign-id-parsing-hardening-2026-04-10.md) | 2026-04-10 | Complete | Helper-based parsing rollout and regression coverage completed; retained as historical follow-up to the production campaign slug parsing fix for cloud-backed content ids. |
