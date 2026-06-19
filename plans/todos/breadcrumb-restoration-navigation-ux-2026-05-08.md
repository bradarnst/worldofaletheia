---
title: Breadcrumb Restoration as Deferred Navigation UX Work
dateAdded: 2026-05-08
status: Complete
priority: Medium
relatedFiles:
  - plans/todos/index.md
  - src/components/site/ArticleContextHeader.astro
  - src/components/WorldAletheiaContentHeader.astro
  - src/layouts/WorldAletheiaContentLayout.astro
  - plans/ui-implementation-handoff-plan-2026-04-14.md
---

# Breadcrumb Restoration as Deferred Navigation UX Work

## Why

Breadcrumbs are part of the expected site UX and existing planning/docs still describe article pages as leading with breadcrumb navigation. Repository evidence also shows shared article-header surfaces still accept and render `parentChain` / `breadcrumbs`, which suggests the user-facing breadcrumb path regressed or was lost rather than never being intended.

This should be tracked as a separate navigation/UX follow-up, not bundled into Sorcerer Spells discovery work or future admin-console/dashboard work.

## Deferred requirement

Restore breadcrumb navigation on applicable article/detail pages where `parentChain` data exists, and verify the restoration works consistently across the shared header/layout path rather than as a one-off page fix.

Likely affected shared surfaces/components:

- `src/components/site/ArticleContextHeader.astro`
- `src/components/WorldAletheiaContentHeader.astro`
- `src/layouts/WorldAletheiaContentLayout.astro`

## Success criteria

- Breadcrumbs are visible again on supported article/detail pages.
- The implementation is treated as a shared navigation UX fix, separate from Sorcerer Spells or admin-dashboard scope.
- The restored behavior matches the documented article-header expectations closely enough to avoid future ambiguity.

## Closeout — 2026-06-19

- `ArticleContextHeader` already rendered breadcrumbs when given a non-empty `breadcrumbs` array.
- World/Canon detail pages were already passing `parentChain` and `relationships` through the shared article header path.
- Using Aletheia and Campaign detail pages now pass `parentChain` and `relationships` through the same shared article header path, so future non-empty metadata renders consistently across the content layout family.
- Current vault verification found no real non-empty `parentChain` entries to screenshot-test; the active content only had empty/template `parentChain` values.
