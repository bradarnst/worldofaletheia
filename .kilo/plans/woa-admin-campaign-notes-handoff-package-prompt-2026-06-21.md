# `woa-admin` Campaign Notes Handoff Package

Date: 2026-06-21
Status: Ready to hand off to architecture/design/planning
Audience: `woa-admin` architecture, API design, service planning, and implementation leads
Source project: World of Aletheia main site (`worldofaletheia.com`)

## Documents To Hand Off

Primary handoff document:

1. `plans/features/woa-admin-campaign-notes-api-handoff-2026-06-21.md`

Use this as the main requirements/context packet. It states what `worldofaletheia.com` needs to consume, what `woa-admin` owns, the required runtime and deploy-time write lanes, read/edit semantics, expected data concepts, API capability checklist, open questions, and readiness criteria.

Supporting architecture/context documents:

2. `.kilo/plans/campaign-notes-option-c-write-session-boundary-2026-06-21.md`

Use this for the agreed Option C boundary: `woa-admin` owns Campaign Notes authority and D1/index/search/audit/finalization, while the main site and producer may write R2 bodies only through `woa-admin`-approved write/import sessions.

3. `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`

Use this for the original Campaign Notes source/live-editing context, Markdown/R2/D1 reasoning, whole-document editing model, optimistic conflict expectations, frontmatter ideas, and current deployed foundation history. Its readiness gate is superseded by the `woa-admin`-first boundary.

4. `plans/adrs/0021-external-admin-capability-boundary.md`

Use this for why privileged/admin/operator capabilities belong outside the public main-site repo by default and why `woa-admin` is the expected owner.

5. `plans/adrs/0019-campaign-membership-role-unification.md`

Use this for campaign authorization semantics: `campaign_memberships` is the canonical campaign role authority, with `member | gm`; `gm` implies campaign-member access; `public` content is readable without membership when deliberately exposed.

6. `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md`

Use this for portable Markdown/frontmatter source-contract context and why Obsidian is preferred but not exclusive. Campaign live notes are a deliberate cloud-writable exception requiring separate architecture.

7. `.kilo/plans/campaign-notes-r2-document-api-implementation-2026-06-20.md`

Use this only as historical context. It is superseded because it assumed the main site would implement direct Campaign Notes R2/D1 API routes. It should not be used as the implementation plan.

Optional tracker/status context:

8. `.kilo/plans/concise-overall-next-steps-2026-06-19.md`

Use this for current main-site workstream status and the fact that main-site Campaign Notes API/editor work is blocked on the approved `woa-admin` contract.

9. `plans/post-roadmap-grill-task-tracker-2026-06-19.md`

Use this for broader roadmap/task-tracker context and the recorded ownership-boundary correction.

## Handoff Prompt

```text
You are taking over architecture/design/planning for the Campaign Notes API/service capability owned by `woa-admin`.

Context:

- The consuming application is the World of Aletheia main site at `worldofaletheia.com`.
- The main site is an Astro/Cloudflare public site and must not own Campaign Notes authoritative D1/index/search/audit state.
- `woa-admin` is expected to own the Campaign Notes API/service contract, storage-layout policy, write/import finalization, conflict behavior, and operational/admin workflows.
- The main site should later consume the approved `woa-admin` contract through an API client.
- Do not treat the suggested endpoint shapes in the handoff as binding. They are consumer-needs sketches. The final API contract belongs to `woa-admin`.

Read these documents first, in order:

1. `plans/features/woa-admin-campaign-notes-api-handoff-2026-06-21.md`
2. `.kilo/plans/campaign-notes-option-c-write-session-boundary-2026-06-21.md`
3. `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`
4. `plans/adrs/0021-external-admin-capability-boundary.md`
5. `plans/adrs/0019-campaign-membership-role-unification.md`
6. `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md`
7. `.kilo/plans/campaign-notes-r2-document-api-implementation-2026-06-20.md` as superseded historical context only

What `worldofaletheia.com` needs to consume:

- Read/list Campaign Notes visible to the current reader.
- Read a full Markdown note body plus canonical metadata.
- Create and update whole Markdown note documents through optimistic conflict handling.
- Request runtime write sessions for browser editor saves.
- Upload Markdown bodies to `woa-admin`-approved R2 targets only.
- Finalize writes through `woa-admin` before a revision becomes canonical.
- Support deploy-time import sessions for Obsidian/Markdown-authored session notes.
- Preserve eventual dual-authoring: a note may be imported from Obsidian/deploy and later edited in the runtime editor.
- Detect deploy-vs-runtime conflicts and never silently overwrite runtime edits during deploy import.
- Surface stale-save conflicts to the main-site editor without losing the user's draft.

Required ownership boundary:

- `woa-admin` owns Campaign Notes D1 state, document identity, current revision, index/search metadata, audit records, storage key policy, write/import sessions, finalization, conflict records, and admin/operator workflows.
- The main site must not directly mutate Campaign Notes D1 state.
- The main site must not invent R2 bucket/prefix/key names.
- The main site may write R2 Markdown bodies only as body transfer to an approved write target from `woa-admin`.
- The deploy-time producer may write R2 Markdown bodies only through approved import sessions or equivalent `woa-admin` import/finalize behavior.

Auth and authorization requirements:

- Do not use Cloudflare Access for this site.
- Better Auth remains authentication for the main-site ecosystem unless a later architecture decision changes that boundary.
- Campaign authorization is based on exact `campaign_memberships.campaign_slug` and role.
- Supported role values are `member` and `gm`.
- Visibility/read semantics:
  - `public`: deliberately publicly readable.
  - `campaignMembers`: readable by campaign `member | gm`.
  - `gm`: readable only by campaign `gm`.
- Edit semantics:
  - default editable by original author and `gm`;
  - optional policy may allow all campaign `member | gm` users to edit a note;
  - public readability must never grant edit rights.

Required write lanes:

Runtime editor lane:

```text
main site editor
  -> woa-admin: request write session
  -> R2: PUT Markdown to approved target
  -> woa-admin: finalize write
  -> woa-admin: update D1/index/search/audit and return canonical metadata
```

Deploy-time Obsidian/Markdown import lane:

```text
Obsidian/Markdown source
  -> producer/deploy sync
  -> woa-admin: request import session or bulk import plan
  -> R2: PUT Markdown to approved target(s)
  -> woa-admin: finalize import
  -> woa-admin: update D1/index/search/audit and return import results
```

Please produce an architecture/design plan for `woa-admin` that includes:

1. The authoritative Campaign Notes data model.
2. Runtime read/list/read-body API behavior.
3. Runtime write-session/finalize/abort behavior.
4. Deploy import-session/finalize behavior, including idempotency.
5. R2 bucket/prefix/key ownership strategy, including path toward per-campaign prefixes or buckets.
6. Auth/session/delegation design between the main site, producer, and `woa-admin`.
7. Visibility/read and edit-policy enforcement.
8. Optimistic concurrency and stale runtime save behavior.
9. Deploy-vs-runtime conflict detection and conflict-record behavior.
10. Audit/logging requirements without logging Markdown bodies, secrets, cookies, tokens, or sensitive identity details.
11. Staging/production environment separation.
12. Example request/response payloads sufficient for main-site API-client tests.
13. A minimum viable API subset that unblocks main-site read/list and runtime editor integration.
14. A migration/remediation note for the already-created main-site `campaign_note_documents` foundation, which should not become the authoritative implementation unless explicitly transferred.

Acceptance criteria for handoff completion:

- `woa-admin` has an approved contract for read/list behavior.
- `woa-admin` has an approved runtime write-session/finalize flow.
- `woa-admin` has an approved deploy import-session/finalize flow or a stated phased substitute.
- Conflict behavior is explicit and prevents silent overwrite across runtime and deploy lanes.
- R2 write targets are issued/approved by `woa-admin`.
- The main site can implement an API client without direct Campaign Notes D1 mutation.
```

## Key Message To Attach To The Handoff

The `worldofaletheia.com` project is asking `woa-admin` to design and own the Campaign Notes API/service contract. The main site is intentionally **not** defining the final endpoint contract. Its requirement is to consume a safe, approved API that supports Campaign Notes read/list, whole-document Markdown editing, deploy-time Obsidian imports, R2 write sessions, conflict handling, and campaign role/visibility enforcement without direct main-site D1 mutation.
