---
title: Separate Campaign Notes from broader Campaign Content
status: accepted
date: 2026-07-01
decision-makers:
  - project owner
consulted:
  - architecture review
informed:
  - future maintainers
---
# Separate Campaign Notes from broader Campaign Content
## Context and Problem Statement

World of Aletheia has two related but different campaign content needs.

Campaign Notes are narrowly scoped note documents: session notes, recaps, downtime notes, GM notes, and player/GM-authored campaign notes that need note visibility, editing, audit, and reconciliation behavior. The `woa-admin` repo already owns the Campaign Notes API/service contract, including D1 current/index/audit state and R2 Markdown bodies.

Broader Campaign Content includes campaign landing pages, overviews, reference pages, metadata, setting summaries, roster-like pages, guides, and other GM-produced or GM-vetted campaign material. This content is authoritative campaign reference material, not user-editable notes.

The existing `aletheia-vault` to `worldofaletheia.com` general content-sync pipeline has historically carried campaign/session note material. Keeping that path active for Campaign Notes would create competing publication and authoring paths. At the same time, moving all campaign material into `woa-admin` Campaign Notes would over-broaden a service designed for note documents.

## Decision Drivers

* keep Campaign Notes narrowly defined
* avoid two active publication paths for campaign/session notes
* avoid making `woa-admin` responsible for broad campaign-content rendering or content-model decisions
* keep user-editable note workflows separate from GM-vetted authoritative campaign content
* support future Campaign-as-a-Service work without prematurely collapsing storage and ownership boundaries
* make the `worldofaletheia.com` migration from old campaign/session-note content-sync explicit

## Considered Options

* Keep campaign/session notes in the existing `aletheia-vault` general content-sync pipeline
* Put all campaign content into the Campaign Notes service
* Separate Campaign Notes from broader Campaign Content

## Decision Outcome

Chosen option: "Separate Campaign Notes from broader Campaign Content", because the two domains have different authorship, ownership, synchronization, and presentation needs.

The approved shape is:

* Campaign Notes remain narrowly scoped to note-like documents: session notes, recaps, downtime notes, GM notes, and player/GM-authored campaign notes.
* `woa-admin` owns Campaign Notes API behavior, D1 current/index/audit state, R2 Markdown body storage, validation, scanner/reconciliation, and note visibility/edit semantics.
* Broader Campaign Content remains owned/rendered by `worldofaletheia.com` for now.
* Broader Campaign Content is fed by a GM-controlled Obsidian vault or Markdown-equivalent directory.
* Campaign Notes and broader Campaign Content are separate logical stores.
* Near-term implementation should use separate R2 buckets for Campaign Notes and Campaign Content.
* Future Campaign-as-a-Service work may revisit physical bucket layout, but consumers should depend on logical store roles rather than bucket names or object layout.
* The existing `aletheia-vault` general content-sync path must stop publishing campaign/session notes once the main-site Campaign Notes integration replaces it.

### Consequences

* Good, because Campaign Notes stay small enough to reason about and operate as an API-backed note service.
* Good, because broad campaign reference content does not inherit note-specific write sessions, edit policy, reconciliation, or audit behavior unnecessarily.
* Good, because the old campaign/session-note content-sync path is explicitly deprecated instead of remaining a hidden second source.
* Good, because separate logical stores allow different sync direction, credentials, validation, access, and owner-service assumptions.
* Bad, because the near-term architecture has more moving pieces: separate Campaign Notes and Campaign Content storage, plus a main-site migration.
* Bad, because cross-content links must be resolved by website routes or stable site URLs rather than relying on local vault adjacency or shared bucket paths.
* Neutral, because broader Campaign Content remains with `worldofaletheia.com` for now; a future architecture/design pass may move or reframe that ownership.

## More Information

Detailed handoff planning is captured in `.kilo/plans/1782818558556-campaign-notes-content-architecture-handoff-plan.md`.

Related contract and implementation references:

* `docs/contracts/campaign-notes-api.openapi.yaml`
* `docs/contracts/campaign-notes-deployment-guide.md`
* `.kilo/plans/1782129981893-campaign-notes-direct-sync-correction-plan.md`
