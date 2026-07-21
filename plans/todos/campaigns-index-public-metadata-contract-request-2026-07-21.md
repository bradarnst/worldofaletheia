---
title: Campaigns Index Public Metadata Contract Request
dateAdded: 2026-07-21
status: Open / External
priority: Medium
relatedFiles:
  - docs/handoff/from-woa-admin/campaign-content-v1-20260717/campaign-content-read-api.openapi.yaml
  - docs/handoff/from-woa-admin/campaign-content-v1-20260717/campaign-content-main-site-handoff.md
---

# Campaigns Index Public Metadata Contract Request

## Context

The main-site `/campaigns` page should list campaigns as public discovery/navigation, even when the campaign's Campaign Gate requires Campaign Membership to enter the campaign area. Campaign titles are not secret; listing only IDs would be useless to visitors.

The exact public metadata shape for campaign cards still needs to be decided. Campaign GMs may want to configure optional display details such as excerpts, summaries, status text, card images, warnings, or other presentation-safe metadata.

## Backlog item

Request a future `woa-admin` Campaign Content Source API capability for Campaigns Index public metadata and add it to the OpenAPI specs in a bundled contract revision.

The request should explore:

- which campaign fields are always public for listing purposes, starting with campaign title;
- which fields are optionally GM-configured for public discovery, such as excerpt or summary;
- whether public listing metadata is derived from the campaign root entry point or a distinct campaign metadata source;
- how Campaign Gate interacts with listing metadata;
- whether unpublished/preview campaigns are excluded from public listing metadata;
- how non-`worldofaletheia.com` API consumers should discover campaign listing metadata without relying on main-site-specific manifests.

## Notes

Do not edit files under `docs/contracts/` directly from the main-site repo. Treat this as an external contract request for the owning project/team. Exact field details are intentionally TBD until the `woa-admin` side can evaluate the contract change.
