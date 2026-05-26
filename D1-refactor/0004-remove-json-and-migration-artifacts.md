---
title: Remove spell JSON and migration artifacts
status: accepted
date: 2026-05-21
decision-makers:
  - project owner
consulted:
  - implementation review
informed:
  - future maintainers
---
# Remove spell JSON and migration artifacts
## Context and Problem Statement
The spell platform now runs on a single active model: D1-backed canonical storage with an admin dashboard and public read API. The repo still contains JSON snapshots, import/export tooling, migration runners, and operator docs that existed only to bridge from earlier storage and handoff phases.

Keeping those temporary paths active makes the current system harder to understand and easier to misuse. The project no longer wants alternate bootstrap, export, or migration workflows preserved in day-to-day code.

## Decision Drivers
* keep the active spell platform easy to reason about
* remove one-time migration scaffolding from runtime and operator workflows
* preserve only the current D1-backed admin and public read paths
* avoid docs that imply JSON artifacts are still part of normal operations
* keep historical context in ADRs and Git history rather than active tooling

## Decision Outcome
Chosen option: remove JSON, import/export, and migration artifacts from the active repo surface.

The approved shape is:

* D1/SQL remains the only active spell persistence model
* admin and public read flows continue to use the current runtime D1 path
* normal JSON HTTP responses remain part of the public API
* JSON stored inside current SQL columns remains allowed where the schema still uses it
* temporary JSON snapshots, export files, import/export scripts, migration runners, and migration SQL history are removed from active workflows
* concise historical context remains in earlier ADRs and plans rather than in operational runbooks

### Consequences
* Good, because the repo now reflects the real operating model instead of preserving transitional paths.
* Good, because tests and tooling exercise the current D1 schema directly.
* Good, because operators get a simpler runbook centered on runtime wiring and read-only verification.
* Bad, because this repo no longer provides a legacy bootstrap path for recreating spell tables from historical JSON artifacts.
* Neutral, because historical migration details remain available in Git history if they are ever needed for investigation.
