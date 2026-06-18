# Feature Roadmap Grill: Main Site, Admin Boundary, and Content Pipeline

Date: 2026-06-17
Status: Draft, awaiting publication-policy design decisions
Scope: Planning only. No source-code changes.

## What This Grill Is For

This plan organizes the user's feature/todo list into decision branches that match the current World of Aletheia architecture. It is not an implementation plan yet. The goal is to avoid mixing public-site work, privileged admin work, and content-producer work into one ambiguous backlog.

## Grounding Decisions Already In Force

- Obsidian remains the authoring source of truth under ADR-0001 unless explicitly reopened.
- Cloud runtime is cloud-default with local rollback under ADR-0010.
- D1 `content_index` is the canonical cloud lookup/discovery index; R2 stores blobs only under ADR-0016.
- Content producer extraction to a dedicated repository is already accepted under ADR-0012, with GitHub Actions-first execution.
- Privileged admin consoles, dashboards, CRUD, taxonomy management, global user/account management, password recovery fallback, and operator workflows belong in `woa-admin` by default under ADR-0021.
- The main site may still host campaign-facing UI that consumes approved `woa-admin` APIs, but it should not own direct D1 mutation endpoints for those workflows.
- Campaign access control uses Better Auth identity plus D1 `campaign_memberships` role `member | gm` under ADR-0019.
- Content `secret` is deprecated and ignored for access control; campaign privacy uses `visibility: public | campaignMembers | gm`.
- Draft policy is currently closed: drafts are included in all environments, and a dedicated draft-preview workflow is not required under `plans/draft-visibility-follow-up-todo.md`.
- Astro islands remain vanilla TypeScript first unless complexity triggers a framework decision under ADR-0007.

## Challenged Terms

- "Draft" currently means publication/status metadata, not a hidden preview state.
- "Preview" is overloaded. It could mean Cloudflare Pages preview deploy, editorial preview of unpublished content, or authenticated preview of protected campaign content.
- "Prod" should mean the production deployment/runtime lane, not a publication state.
- "Secret" is deprecated metadata and must not be treated as security.
- "Admin" is overloaded. Global/operator admin belongs in `woa-admin`; campaign-scoped self-service UI can remain in the main site only as an API consumer.
- "R2 direct sync" already exists in the current pipeline. The unresolved issue is write authority and reverse/export policy, not basic R2 capability.
- "Obsidian source of truth" conflicts with in-app editing unless in-app editing writes back to the true source or the source-of-truth model is changed.

## Recommended Workstream Buckets

### Workstream A: Publication State and Access Semantics

Primary question: reopen or preserve the current draft policy.

Candidate scope:
- Define canonical meanings for `draft`, `review`, `publish`, `published`, `archive`, `archived`, `visibility`, and deprecated `secret`.
- Decide whether UI should label draft/review entries in production.
- Decide whether Cloudflare preview deploys should differ from production for public content.
- Confirm that protected campaign content remains controlled only by `visibility` plus request-time authz.
- Add user-facing and operator-facing test cases after policy is fixed.

Recommendation:
- Preserve the current policy unless there is a concrete need for hidden editorial preview. Treat this workstream as UI labeling, tests, and documentation cleanup rather than a new preview system.

### Workstream B: Main-Site UX and User Testing

Candidate scope:
- Audit current public UI/UX against the four-layer IA.
- Run user tests for sign-up, sign-in, adding campaign users, exact-email errors, password reset, contact, and contribute.
- Verify that campaign management UI consumes `woa-admin` APIs and does not drift into direct D1 mutation ownership.
- Verify email validation behavior: `trim(lower(email))`, exact lookup, no global user search, safe duplicate handling, and no enumeration outside approved cases.
- Verify contact/contribute form behavior against ADR-0020 and Mailjet constraints.

Recommendation:
- Start with tests and observed UX failures, not redesign. The current architecture already defines most boundaries; the likely value is in finding mismatches between UI copy, API errors, and user expectations.

### Workstream C: Campaign Sessions and Notes

Primary question: are session notes content, private campaign records, or live app data?

Candidate options:
- Keep session notes as markdown authored externally and synced through the producer pipeline.
- Add in-app note editing that writes to an external campaign/content producer API, not directly to source markdown inside the public site.
- Build richer campaign tooling as an Astro island only for bounded UI state; reconsider framework adoption only if real-time multi-user editing or complex editor state appears.

Recommendation:
- Treat session logs intended for publication as content pipeline artifacts.
- Treat table notes, GM notes, player notes, and editable campaign state as future campaign-app/admin capabilities, probably owned by `woa-admin` or a later Campaigns service.
- Do not add rich in-app markdown editing to the public site until write authority is settled.

### Workstream D: Content Sync, R2, and Source of Truth

Primary question: does source-of-truth stay at the authoring source, or move to cloud storage/index after ingestion?

Current facts:
- `scripts/content-sync` already supports cloud mappings, R2 upload, stale object handling, D1 metadata/index reconciliation, wiki-link transformation, and image path conversion.
- ADR-0016 says D1 is lookup/index authority and R2 stores blobs only.
- ADR-0012 says the producer should eventually move out of this repo.

Candidate scope:
- Clarify whether R2/D1 are publication outputs or canonical editable storage.
- Decide whether multi-user authoring means shared Obsidian vault, per-user vaults into one producer, or non-Obsidian markdown sources that meet the same frontmatter/link contract.
- Review Obsidian link variants, embedded images, aliases, anchors, and unresolved link behavior.
- Review image caption and contributor attribution validation rules before making them hard failures.
- Decide whether folders remain route hints or whether frontmatter becomes the sole routing/collection authority.

Recommendation:
- Keep R2/D1 as published cloud outputs for now, not authoring SoT.
- Allow non-Obsidian tools only if they produce the same markdown/frontmatter/link contract.
- Avoid reverse sync from R2/D1 back to Obsidian unless a new ADR explicitly changes the one-way architecture.

### Workstream E: Templates and Authoring Ergonomics

Candidate scope:
- Create complete Obsidian templates for every collection and campaign-family collection.
- Decide whether templates rely on folder context, frontmatter prompts, or a producer-side validation wizard.
- Confirm unique identity policy for filenames/slugs across collections and cloud index rows.
- Add validation messages that point authors to exact template fixes.

Recommendation:
- Prefer folder-aware templates for human ergonomics plus frontmatter validation for machine authority.
- Do not rely on folder alone for core collection/type/campaign facts where the schema already requires frontmatter.

### Workstream F: `woa-admin` Handoffs

Candidate scope:
- Move or finish campaign member management mutation ownership in `woa-admin`.
- Keep the main site as front-end/API consumer only for campaign-scoped management UI.
- Track taxonomy management, global user/account management, password reset fallback, provider linking, session revocation, audit logs, and destructive user actions in `woa-admin`.
- Define API contracts and generated/client DTOs before main-site UI work depends on them.

Recommendation:
- Treat `woa-admin` as the mutation boundary for privileged and operator-facing workflows.
- Keep main-site work limited to public UI, campaign-scoped UI shell/client behavior, display states, and integration tests against approved contracts.

## Dependency Order

1. Decide publication/source-of-truth policy before implementing editing, preview, or note-taking features.
2. Verify the main-site campaign user-management boundary before improving its UX.
3. Run user tests for auth/email/contact before adding new account or invitation features.
4. Decide session-notes ownership before adding rich formatting/images to Campaigns.
5. Tighten content-sync validation and templates before expanding multi-user authoring.
6. Move producer/admin responsibilities only after contracts and rollback lanes are explicit.

## Recommended First Slice After Decisions

If the draft/preview policy is not reopened:
- Create a focused UX/test plan for auth, email validation, campaign member management, and contact/contribute forms.
- Include manual test scripts and expected copy/error states.
- Use findings to choose the first implementation issue.

If the draft/preview policy is reopened:
- Draft a new ADR or ADR amendment before implementation.
- Define environment behavior, content status behavior, SEO/crawler behavior, and sync/build impact.

## First Question To Resolve

Should the existing closed policy stand that `draft` entries remain visible in production and `secret` is ignored for access control, with this work limited to UI labeling/tests/docs, or should the draft/preview/publication policy be reopened as a real architecture change?

Recommended answer: keep the existing policy. Reopen only if you need hidden editorial preview or if publishing draft content to production has caused a real user-facing or privacy problem.

User answer: reopen the policy.

## Active Publication-Policy Branch

Because the policy is reopened, implementation should pause until a new ADR or ADR amendment defines:

- what `draft`, `review`, `publish`, `published`, `archive`, and `archived` mean,
- whether Cloudflare preview deploys are editorial preview surfaces,
- whether authenticated users can preview unpublished content in production,
- whether drafts are indexed into D1/R2 in production lanes,
- how `robots`/SEO behavior changes for previewable but unpublished content,
- how campaign `visibility` interacts with publication status,
- whether deprecated `secret` remains ignored or is removed from author-facing templates.

Current recommendation after the user answer:

- Hide `draft` and `review` content from public production routes and public search/discovery.
- Include `draft` and `review` in local development and Cloudflare preview deploys.
- Keep `secret` deprecated and never restore it as an authorization mechanism.
- Keep campaign privacy separate: `visibility` remains the only access-control frontmatter field.
- Treat this as an ADR-level change because it alters author expectations, sync/index behavior, and production route behavior.

Second user answer:

- A flag/state that goes to preview by default and does not go to production is desirable.
- There is also a valid need to publish something to production while visibly marking it as likely to change, unfinished, draft-like, or provisional.
- A GM/spoiler-oriented marker is also desirable, with standard warning language for readers.

Refined model under consideration:

- Separate publish lane from editorial maturity instead of overloading one `status` field.
- Candidate publish lane: `previewOnly | public | archived`.
- Candidate editorial maturity: `draft | unfinished | mayChange | stable` or a smaller equivalent set.
- Candidate audience/spoiler marker: label-only warning by default, with actual access control remaining limited to campaign `visibility` unless a new ADR deliberately expands authz beyond Campaigns.

Third user answer:

- The GM/spoiler marker is label-only.
- It must not restrict access and must not be treated as a security or authorization boundary.

Resulting constraint:

- Avoid reviving `secret` as a field name or concept.
- Prefer names like `contentWarning`, `audienceNote`, `spoilerWarning`, or `gmSpoilers` that communicate reader guidance rather than access control.
- Campaign access remains governed only by `visibility` plus Better Auth/D1 campaign membership checks.

Fourth user answer:

- Use separate frontmatter fields rather than one combined status enum.

Resulting model direction:

- One field controls production inclusion and archive behavior.
- One field controls the public reader-facing editorial maturity badge.
- One field controls label-only audience/spoiler warnings.
- Existing `visibility` remains separate and applies to Campaigns authorization only.

Fifth user answer:

- Use clear new field names rather than preserving overloaded `status` semantics.

Proposed field names for ADR draft:

- `publication`: production inclusion and archive behavior.
- `contentState`: reader-facing editorial maturity label.
- `audienceWarnings`: label-only warnings such as GM spoilers.

Migration impact:

- Existing `status` frontmatter becomes legacy input during a migration window.
- Templates and content-sync validation should move authors to the new fields.
- D1 index rows and public UI should derive from the new fields after migration.

Sixth user answer:

- Use a small initial value set.

Accepted draft value set:

- `publication`: `preview | publish | archive`
- `contentState`: `stable | mayChange | unfinished`
- `audienceWarnings`: array, initially allowing `gmSpoilers`

Semantics to encode in ADR:

- `publication: preview` is included in local development and preview deploys, excluded from public production routes/search/discovery.
- `publication: publish` is allowed in production.
- `publication: archive` is excluded from normal public listing unless an explicit archive surface later exists.
- `contentState` affects visible reader labeling only.
- `audienceWarnings` affects visible reader warnings only.

Seventh user answer:

- Migrate existing content with a "publish most content" policy.

Migration policy to encode:

- Existing `status: archive | archived` maps to `publication: archive`.
- Existing non-archive content generally maps to `publication: publish`.
- Existing uncertainty should be expressed through `contentState`, not by hiding large amounts of current content from production.
- This preserves current public-site behavior while still introducing a safer model for new content and future preview-only items.

Eighth user answer:

- New content templates should default to `publication: preview`.

Authoring implication:

- New entries are not production-eligible until intentionally promoted to `publication: publish`.
- Templates should make promotion explicit and easy to understand.
- Content sync validation should treat missing `publication` on new-style content as invalid once the migration window closes.

Ninth user answer:

- `publication: preview` content should be physically excluded from production R2/D1.

Storage/pipeline implication:

- Production sync/publish must not upload preview-only markdown or media to production R2.
- Production sync/publish must not write preview-only entries to production D1 discovery/search indexes.
- Preview deploys need a non-production content target if they are expected to show preview-only content.
- Runtime filtering remains necessary as defense-in-depth, but it is not the primary protection for preview-only content.

Tenth user answer:

- Cloudflare preview deploys should read from the staging content target.

Pipeline implication:

- Staging sync can include `publication: preview` and `publication: publish` content.
- Production sync includes `publication: publish` content only, plus whatever archive behavior is explicitly designed.
- Preview deploy runtime should use staging D1/R2 bindings or equivalent staging prefixes.
- Production runtime should not have preview-only blobs or index rows available.

Publication branch status:

- Enough decisions are now available to draft a focused ADR amendment/ADR and an implementation plan for schema, sync, index, template, and UI behavior.

## Active Campaign Sessions/Notes Branch

Eleventh user answer:

- Session and note content should always support publish/import from markdown files.
- A later phase should allow live session notes.
- Live session notes should go to the same storage if feasible.

Immediate interpretation:

- Phase 1 should preserve markdown import/publish as a permanent capability.
- Phase 2 may add live note writing, but this reopens source-of-truth and write-authority questions for the Campaigns domain.
- The phrase "same storage" must be clarified because current R2/D1 is designed as producer output, not as an in-app authoring store.

Twelfth user answer:

- A cloud-first writable exception is acceptable outside main-site Canon when there is a strong reason.
- Live campaign session notes are currently the only strong reason.
- A two-way sync back to Obsidian is desirable for live non-Obsidian notes.
- Campaigns likely need separate Obsidian vaults over time, eventually separated per campaign.
- Main-site Canon remains 100% Obsidian-first.
- Campaign vaults should default to Obsidian-first, but allow optional/additional non-Obsidian session notes that sync back to the campaign vault.

Architecture impact:

- The one-way Obsidian-first rule should remain intact for Canon and Using/Reference content unless separately reopened.
- Campaigns may need a domain-specific ADR allowing bounded two-way sync for live notes only.
- Campaign storage identity should become explicit: campaign vault, campaign slug, R2/S3 target, D1 index rows, and conflict behavior.
- This should not be hidden inside the main-site public Astro app; it belongs in the content producer / campaign tooling boundary.

Thirteenth user answer:

- Separate buckets per campaign may be needed eventually because campaigns can be owned by other people and may become paid services.
- Prefix-based separation is acceptable to consider if it can provide enough practical isolation for early stages.
- Separate D1 databases, PostgreSQL, or another backend may eventually be needed, but not immediately.
- Do not boil the ocean. Use staged separation as long as each stage moves toward customer-grade campaign isolation.
- Campaigns must still connect easily to main-site Canon, calendar, eclipses, and maps.

Tenancy direction:

- Short-term design should introduce explicit tenant/campaign boundaries without forcing one bucket/database per campaign immediately.
- Long-term architecture should preserve a path to per-campaign resource isolation or a dedicated Campaigns backend.
- Canon/reference data remains shared public material consumed by campaign experiences.

Fourteenth user answer:

- First tenancy stage should be logical isolation.

Near-term target:

- Introduce explicit tenant/campaign identity in producer config and storage/index rows.
- Use per-campaign vault mappings.
- Use per-campaign R2 prefixes or equivalent logical namespaces in the first stage.
- Keep shared D1/index infrastructure initially, but require tenant/campaign keys in all campaign rows.
- Preserve migration path to per-campaign buckets, separate indexes, PostgreSQL, or a dedicated Campaigns service later.

Fifteenth user answer:

- First live-note sync conflict model should be append-only live notes.

Live-note v1 implication:

- In-app live notes create new append records or append-only note files.
- V1 should not support bidirectional editing of the same markdown file from both Obsidian and the app.
- Sync-back to Obsidian campaign vaults can materialize live notes as timestamped/session-scoped markdown artifacts.
- Human-authored Obsidian files remain safe from app-side overwrite conflicts.

Sixteenth user answer:

- First live-note editor phase should support a Markdown subset.

Editor implication:

- Start with a bounded Markdown text area and server-side validation/sanitization.
- Support headings, lists, emphasis, and normal links first.
- Defer image upload/embed, rich link pickers, and richer editor UI until storage and sync-back behavior is proven.
- Vanilla TypeScript remains sufficient for the first editor phase unless later UX complexity triggers ADR-0007 re-evaluation.

## Active Authoring Contract Branch

Seventeenth user answer:

- Use contract over tool.

Authoring implication:

- Obsidian remains the default and preferred authoring UX.
- The architecture should not require Obsidian if another tool can produce the required Markdown/frontmatter/link/media contract.
- Producer validation becomes the real enforcement boundary.
- Templates should optimize for Obsidian, but the source contract should be portable.

Eighteenth user answer:

- Frontmatter is king.
- Folder hierarchy is for human organization and website routing convenience, but it should not be the canonical authority when frontmatter can define the same facts.
- An inbox concept may be desirable: authors can create files in a root/inbox and let sync or a script place them according to frontmatter.

Authoring model direction:

- Treat folder/path as derived or validated placement.
- Treat frontmatter as the strict contract for collection, type, campaign, publication, and related metadata.
- Support an inbox workflow only through producer tooling, not through runtime route inference.

Nineteenth user answer:

- Inbox movement should be propose-then-approve.

Inbox workflow implication:

- Producer dry-run computes destination from frontmatter.
- Author/operator reviews proposed moves before mutation.
- Valid files are not silently moved in v1.
- This matches the existing content-sync safety posture around stale files and destructive actions.

## Resolved Decisions From This Grill

Publication model:

- Reopen the old draft policy and replace it with an ADR-level publication model.
- Use new clear fields: `publication`, `contentState`, and `audienceWarnings`.
- Initial values:
  - `publication: preview | publish | archive`
  - `contentState: stable | mayChange | unfinished`
  - `audienceWarnings: [gmSpoilers]` initially
- Existing non-archive content mostly migrates to `publication: publish`.
- New templates default to `publication: preview`.
- `publication: preview` content is excluded from production R2/D1.
- Staging content targets include preview content and serve Cloudflare preview deploys.
- `gmSpoilers` is label-only, never authorization.
- Campaign access remains `visibility` plus Better Auth/D1 membership checks.

Campaign sessions/notes:

- Always support markdown import/publish for sessions and notes.
- Later live session notes are allowed as a cloud-first exception outside main-site Canon.
- Canon remains 100% Obsidian/source-contract first.
- Campaigns can move toward per-campaign vaults.
- First tenancy stage is logical isolation: tenant/campaign ids, per-campaign vault mappings, per-campaign storage prefixes, shared D1 with tenant keys.
- Preserve a later path to per-campaign buckets/databases or a Campaigns backend if paid/external ownership requires it.
- Live-note v1 is append-only to avoid bidirectional same-file conflicts.
- Live-note editor v1 uses a Markdown subset; images/rich link pickers/rich editor are later phases.

Authoring/content producer:

- Contract over tool: Obsidian is preferred, not required.
- Frontmatter is king.
- Folder hierarchy is derived/validated human organization and route placement.
- Inbox workflow is allowed as producer tooling with propose-then-approve moves.

Admin boundary:

- ADR-0021 remains intact.
- Privileged admin/operator workflows belong in `woa-admin` by default.
- Main-site campaign management UI should consume approved `woa-admin` APIs and avoid direct D1 mutation ownership.

## Implementation-Ready Plan

### Phase 1: Publication Policy ADR — Complete

Status: Completed on 2026-06-18.

Completed decision artifacts:

- `plans/adrs/0024-content-publication-metadata-model.md` defines the narrow metadata model: `publication`, `contentState`, `audienceWarnings`, legacy `status` migration, deprecated `secret`, and `gmSpoilers` as label-only.
- `plans/adrs/0010-global-content-source-mode-cloud-default.md` now assigns Cloudflare preview deploys to the staging content target.
- `plans/adrs/0015-seo-and-crawler-governance-policy.md` now covers production SEO/search/sitemap exclusion for preview-only content.
- `plans/adrs/0016-d1-as-canonical-cloud-content-index-and-r2-blob-storage.md` now covers production vs staging D1/R2 publication filters.
- `plans/adrs/0019-campaign-membership-role-unification.md` now clarifies that `audienceWarnings: [gmSpoilers]` is never authorization input.
- `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md` separates the source-contract decision from publication policy.
- `plans/adrs/0001-obsidian-first-content-architecture.md` now points to ADR-0025 as a clarification.

Acceptance criteria status:

- Complete: The ADR set unambiguously defines production, staging, preview, and local behavior.
- Complete: Production storage/index excludes `publication: preview` content by ADR-0016 policy.
- Complete: Existing non-archive content migration keeps the current site broadly visible by ADR-0024 policy.
- Complete: New templates default new content to preview by ADR-0024 policy.

### Phase 2: Publication Schema/Sync Plan — Next

Phase 2 entry status: ready to plan/implement from the accepted ADR set.

Implement or plan:

- `src/content.config.ts` schema changes.
- Content-sync validation changes.
- D1 index schema or row-field additions if needed.
- R2/D1 publish filters for staging and production sync.
- Template updates for all collections and campaign-family collections.
- A migration script or checklist for existing frontmatter.
- UI badges for `contentState` and `audienceWarnings`.

Acceptance criteria:

- `pnpm content:sync:staging:dry-run` shows preview and publish content in staging lane.
- `pnpm content:sync:prod:dry-run` excludes preview content.
- Public production search/listing cannot return preview content.
- Preview deploys read staging target content.

### Phase 3: Campaign Notes/Tenancy HLD

Create an HLD, and likely a follow-up ADR, covering:

- Per-campaign vault mapping.
- Logical tenant/campaign isolation in storage and indexes.
- Markdown import/publish as a permanent path.
- Append-only live notes as a cloud-first Campaigns exception.
- Sync-back/export to campaign Obsidian vaults.
- Conflict avoidance by forbidding same-file bidirectional editing in v1.
- Future path to per-campaign buckets, separate indexes/databases, PostgreSQL, or Campaigns service extraction.

Acceptance criteria:

- The plan clearly separates Canon source rules from Campaign source rules.
- It defines where live notes are written and how they sync back.
- It does not put privileged write orchestration inside public-site rendering routes.
- It preserves campaign links to shared Canon/reference/calendar/map material.

### Phase 4: Main-Site UX/Test Plan

After the policy ADR is in motion, produce a user-test plan for:

- adding campaign users through main-site UI backed by `woa-admin` APIs,
- email normalization and exact-email errors,
- login/sign-up/password reset,
- contact/contribute form validation and Mailjet failure states,
- publication/content-state badges and spoiler warnings,
- preview vs production expectations.

Acceptance criteria:

- Test scripts name routes, preconditions, expected UI copy, and expected API states.
- Tests distinguish main-site UI responsibilities from `woa-admin` API/business-logic responsibilities.

## Deferred Decisions

- Whether campaign tenancy eventually moves to per-campaign buckets, separate D1 databases, PostgreSQL, or another backend.
- Whether live Campaign notes become part of a separate Campaigns service.
- Whether image upload/embed lands in live notes after Markdown-subset v1.
- Whether rich link pickers or a framework-based editor are justified later.
- Whether contributor/image attribution warnings become hard validation failures.
