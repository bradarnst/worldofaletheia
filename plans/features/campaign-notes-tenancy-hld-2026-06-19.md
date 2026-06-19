# Campaign Notes and Tenancy HLD

## Status

- Date: 2026-06-19
- Status: Proposed architecture artifact
- Scope: Campaign vault mapping, logical tenant isolation, append-only live notes, sync-back/export, and future storage separation.
- Related ADRs: `0001`, `0004`, `0007`, `0009`, `0010`, `0016`, `0021`, `0024`, `0025`.

## Context

Campaigns are the first World of Aletheia domain expected to grow beyond static reference content. Current campaign content is still authored through the portable Markdown/frontmatter contract and published through the content-sync pipeline into D1/R2. Future live notes introduce a write path, but that write path must not weaken the existing Obsidian-first source-of-truth model for normal content.

## Goals

1. Keep per-campaign content logically isolated by campaign slug.
2. Preserve Obsidian/vault markdown as the durable editorial source for published campaign content.
3. Allow append-only live notes as a narrow Campaigns-domain exception, not a general CMS pattern.
4. Provide a safe export/sync-back path from live notes to campaign vaults.
5. Leave a clean migration path to per-campaign buckets, indexes, databases, or a separate Campaigns service.

## Non-goals

- No live-note editor implementation in this repo before an approved LLD.
- No bidirectional same-file editing between Obsidian and the website.
- No Cloudflare Access checks; auth remains Better Auth and campaign authorization remains exact `campaign_memberships` slug/role checks.
- No campaign member mutation endpoints; those remain external API behavior.
- No privileged admin/operator console work in this repo.

## Proposed model

### Tenant identity

The logical tenant key is the canonical campaign slug. Every campaign note, live-note stream, R2 object, D1 row, export artifact, and future storage partition must carry or derive from this slug exactly.

### Storage lanes

1. **Published campaign content** — existing Obsidian/vault markdown synced into R2 and indexed in D1.
2. **Live note append log** — future cloud-first append-only events scoped by campaign slug, session, actor, and timestamp.
3. **Export/sync-back artifacts** — generated markdown bundles or patches intended for deliberate operator import into the campaign vault.

### Write authority

- Normal campaign pages remain source-authored in markdown and published by sync.
- Live notes may be written at runtime only as append events.
- A live-note event never edits an existing published markdown file directly.
- Promotion from live notes to published notes is an explicit export/import workflow.

## High-level data shape

```text
campaign_note_events
- id
- campaign_slug
- session_id nullable
- actor_user_id
- event_type: note_appended | note_redacted | export_created
- body_markdown nullable
- metadata_json
- created_at

campaign_note_exports
- id
- campaign_slug
- source_event_high_watermark
- r2_key
- status: generated | imported | superseded
- created_by_user_id
- created_at
```

The table names are conceptual. A concrete migration requires a follow-up data-modeling pass.

## Authorization boundary

- Read/write access must check Better Auth session plus exact `campaign_memberships.campaign_slug`.
- `member` can read/write normal session notes only if the campaign policy allows it.
- `gm` can read/write GM-scoped notes and generate exports.
- `gmSpoilers` remains label-only publication metadata; it is not authorization.

## Export/sync-back workflow

1. User appends live notes during a campaign session.
2. System stores immutable note events under the campaign slug.
3. GM generates an export artifact for a selected session/range.
4. Export writes markdown to R2 and records the high-watermark event id.
5. Operator imports the export into the campaign vault outside the public-site runtime.
6. Normal content sync publishes the imported markdown back through the existing D1/R2 pipeline.

## Future separation path

Start with logical isolation in current D1/R2 resources. If scale, privacy, extraction, or operational needs demand stronger boundaries, move in this order:

1. Separate R2 prefixes per campaign.
2. Separate per-campaign D1 tables or database namespaces.
3. Separate per-campaign buckets/indexes.
4. Extract Campaigns to a dedicated service with the same slug-scoped contract.

## Risks and mitigations

- **Bidirectional edit conflicts:** forbid same-file runtime editing; use append-only events and explicit export/import.
- **Tenant leakage:** require exact slug predicates on every query and object key.
- **Scope creep into CMS:** keep live notes Campaigns-only and do not generalize it to Canon or Using Aletheia.
- **Authorization drift:** keep checks server-side and tied to Better Auth + `campaign_memberships` only.
- **Operational ambiguity:** exports are artifacts for operator import, not automatic writes back into Obsidian.

## Open decisions for LLD

1. Which note scopes exist in v1: session, campaign, GM-private, player-visible?
2. Are players allowed to append shared notes, or only GMs?
3. What redaction model is acceptable for append-only logs?
4. What export markdown shape best fits the campaign vault templates?
5. Should live note storage start in D1 only, R2 only, or D1 metadata plus R2 bodies?
6. What event retention policy is required after export/import?
7. What UI latency and offline behavior are required for a first live-note island?
