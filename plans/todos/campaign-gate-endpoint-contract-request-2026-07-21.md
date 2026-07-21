---
title: Campaign Gate Endpoint Contract Request
dateAdded: 2026-07-21
status: Open / External
priority: Medium
relatedFiles:
  - docs/handoff/from-woa-admin/campaign-content-v1-20260717/campaign-content-read-api.openapi.yaml
  - docs/handoff/from-woa-admin/campaign-content-v1-20260717/campaign-content-main-site-handoff.md
---

# Campaign Gate Endpoint Contract Request

## Context

The main-site Campaign Content integration needs a campaign-level gate for `/campaigns/{campaignSlug}/...` with published values `public` or `campaignMembers`. For the first main-site integration, this can be handled by a non-dynamic main-site manifest that defaults missing entries to `campaignMembers` and logs warnings.

Longer term, `woa-admin` should expose campaign gate metadata through the Campaign Content Source API so campaign owners/GMs can manage the gate at the source of truth and API consumers do not depend on main-site-specific operator manifests.

## Backlog item

Request a `campaignGate` capability from `woa-admin` and add it to the Campaign Content OpenAPI specs in a future bundled contract revision.

The request should clarify:

- the canonical campaign gate values are `public` and `campaignMembers`;
- `gm` is not a published campaign gate value;
- item-level visibility remains `public`, `campaignMembers`, or `gm`;
- effective item access is constrained by both the campaign gate and item visibility;
- campaign source availability remains owned by `woa-admin` / its campaign content bucket state;
- `worldofaletheia.com` remains the browser-facing authorization boundary for its users.

## Notes

Do not edit files under `docs/contracts/` directly from the main-site repo. Treat this as an external contract request for the owning project/team.
