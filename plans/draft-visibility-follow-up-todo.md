# Draft Visibility Policy Closure

> **Superseded:** This policy has been superseded by [ADR-0024: Content Publication Metadata Model](adrs/0024-content-publication-metadata-model.md). Treat this file as historical context only; implementers should follow ADR-0024 for current publication, content-state, and audience-warning semantics.

## Context

Previous policy was temporary while preview workflow questions were still open.

Access policy clarification (2026-03):

- `secret` is deprecated and ignored for access control.
- Campaign access control should use `visibility` values (`public`, `campaignMembers`, `gm`).
- GM labels are metadata-only for discovery/filtering and are not security gates.

## Final Decisions

- Draft entries remain visible in all environments.
- UI may optionally indicate `draft` status and may expose draft as a filter.
- No dedicated draft-preview workflow is required for the current publishing model.
- `gm`, `gm-data`, and `gm-info` remain optional honor-system metadata only.
- If `gm-info` is present, including `gm-info: 'true'`, UI may optionally surface it and discovery UIs may optionally filter by it.
- These metadata fields never act as authorization gates.

## Implementation State

- `src/utils/content-filter.ts` treats drafts as always included.
- `src/content.config.ts` accepts optional `gm-info` metadata for content entries.

## Closed Follow-ups

- Dedicated draft preview workflow: not required under current policy.
- Environment-based draft exclusion in `shouldIncludeContent()`: not applicable.
- Honor-system GM metadata guidance: resolved by policy above.

## Still Separate Work

- A `content:sync` force/reprocess mode remains a separate sync-pipeline enhancement.
- Campaign authoring guidance for `visibility` values remains covered by campaign access planning, not this closure item.
