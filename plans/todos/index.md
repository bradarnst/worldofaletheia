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
| [External Admin Taxonomy Management Requirement](./admin-console-and-taxonomy-management-2026-04-25.md) | 2026-04-25 | Open / External | Tracks taxonomy management as a 100% external-admin requirement with workflow guidance and safeguards; not an in-repo admin console task. |
| [Future Related Resource Enrichment and Spell Discovery](./related-resource-enrichment-and-spell-discovery-2026-04-27.md) | 2026-04-27 | Open / Future | Tracks future promoted-resource UX/enrichment ideas; not next work, and spell data/API authority remains external. |

## Completed Todos

| Title | Date Added | Status | Notes |
| --- | --- | --- | --- |
| [Campaign ID Parsing Hardening](./campaign-id-parsing-hardening-2026-04-10.md) | 2026-04-10 | Complete | Helper-based parsing rollout and regression coverage completed; retained as historical follow-up to the production campaign slug parsing fix for cloud-backed content ids. |
| [Breadcrumb Restoration as Deferred Navigation UX Work](./breadcrumb-restoration-navigation-ux-2026-05-08.md) | 2026-05-08 | Complete | Shared layout/header breadcrumb plumbing restored for World, Using Aletheia, and Campaign detail paths; future visual verification awaits real non-empty `parentChain` content. |
