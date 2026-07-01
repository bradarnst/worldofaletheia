---
title: Use API-mediated website writes and GM-operated direct R2 sync for Campaign Notes
status: accepted
date: 2026-07-01
decision-makers:
  - project owner
consulted:
  - architecture review
informed:
  - future maintainers
---
# Use API-mediated website writes and GM-operated direct R2 sync for Campaign Notes
## Context and Problem Statement

Campaign Notes need to support two authoring experiences:

1. campaign members and GMs creating or editing notes through the `worldofaletheia.com` website UX; and
2. GMs/operators working in a separate Campaign Notes Obsidian vault or Markdown-equivalent directory.

The existing `woa-admin` Campaign Notes contract already supports API-mediated runtime writes, stable R2 Markdown source paths, D1 current/index/audit state, and scanner reconciliation for direct R2 sync. The architecture needs to clarify how these write paths coexist without silently losing content or weakening user-level edit controls.

The website UX path has user identity, edit policy, expected revision/hash checks, and immediate API feedback. The direct R2 sync path is GM/operator-controlled and can mirror Markdown bidirectionally with the Campaign Notes R2 bucket, but it does not provide reliable per-human runtime identity for each local vault edit.

## Decision Drivers

* allow regular campaign members to author notes through the website UX
* allow GMs/operators to use Obsidian or a Markdown directory as an authoring environment
* keep direct R2 credentials away from regular campaign members
* avoid requiring a custom import-session API for Obsidian/vault sync
* avoid silent overwrites between website edits and vault edits
* make website saves visible immediately after successful validation/finalization
* keep V1 audit behavior honest about what identity is actually known
* avoid adding a manual approval queue before there is a demonstrated need

## Considered Options

* Use only website/API-mediated writes for Campaign Notes
* Use only direct vault/R2 sync for Campaign Notes
* Use API-mediated website writes and GM-operated direct R2 sync for Campaign Notes

## Decision Outcome

Chosen option: "Use API-mediated website writes and GM-operated direct R2 sync for Campaign Notes", because it supports both user-facing note creation and GM/operator Markdown workflows while preserving `woa-admin` ownership of validation, canonical state, and conflict behavior.

The approved shape is:

* The runtime editor lane is `worldofaletheia.com` UX -> `woa-admin` write-session APIs -> Campaign Notes R2 object -> D1 current/index/audit state.
* The direct R2 sync lane is Campaign Notes vault or Markdown directory <-> Campaign Notes R2 bucket -> `woa-admin` scanner/reconciler -> D1 current/index/audit state.
* The Campaign Notes vault is a bidirectional mirror of the Campaign Notes R2 bucket/prefix.
* Regular campaign members author Campaign Notes only through the website UX/API path.
* Direct R2 sync credentials are GM/operator-only.
* Website-created or website-edited notes become visible immediately after successful `woa-admin` finalize.
* Vault-authored or vault-edited notes become visible after scanner reconciliation.
* Valid vault-synced changes become current automatically after scanner reconciliation; V1 has no manual approval queue.
* GM/operator vault sync may supersede website-authored note content by overwriting the same stable R2 object.
* Website writes must detect stale revision/R2 drift and fail with conflict rather than blindly overwrite newer vault-synced content.
* V1 direct R2 sync audit attribution is `r2Sync`, not a specific GM user, unless future sync tooling can provide reliable signed identity.
* Note authorship remains represented by `authorUserIds`, but that is content attribution rather than proof of who performed a direct R2 write.

### Consequences

* Good, because campaign members get a website-native note authoring path without direct storage credentials.
* Good, because GMs/operators can use Obsidian or Markdown tooling without a purpose-built import API.
* Good, because website saves can give immediate success/failure feedback and become visible after finalize.
* Good, because direct R2 sync remains reconciled through `woa-admin` validation and D1 indexing instead of becoming an independent source of truth.
* Good, because stale website edits are protected from blindly overwriting newer vault-synced content.
* Bad, because two write lanes require clear runbooks, scanner operations, and conflict UX.
* Bad, because direct vault sync has weaker per-human write attribution in V1; audit can honestly say `r2Sync`, not which GM edited the local file.
* Bad, because automatic acceptance of valid vault changes means a mistaken GM/operator sync can update live note content before manual review.
* Neutral, because a future signed-sync or approval workflow can be added if operational experience shows it is needed.

## More Information

Detailed handoff planning is captured in `.kilo/plans/1782818558556-campaign-notes-content-architecture-handoff-plan.md`.

Related contract and implementation references:

* `docs/contracts/campaign-notes-api.openapi.yaml`
* `docs/contracts/campaign-notes-deployment-guide.md`
* `.kilo/plans/1782129981893-campaign-notes-direct-sync-correction-plan.md`
