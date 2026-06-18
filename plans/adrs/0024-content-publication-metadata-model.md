# Content Publication Metadata Model

## Status

- Date: 2026-06-17
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

World of Aletheia has historically used a single `status` field to carry several different meanings at once: editorial readiness, production inclusion, and archive-like behavior. The schema also still accepts deprecated `secret` metadata, but project policy already says `secret` must not participate in access control.

That model is no longer precise enough for the current publishing workflow. The project needs content frontmatter to express three distinct facts without overloading one field:

1. whether content is intended for publication or only preview/review,
2. how readers should understand editorial maturity for visible content,
3. whether content needs label-only audience/spoiler guidance.

This ADR decides the content metadata model only. Operational consequences for cloud runtime targets, D1/R2 sync inclusion, and crawler behavior are governed by ADR-0010, ADR-0016, and ADR-0015 respectively.

This ADR replaces the closed draft policy recorded in `plans/draft-visibility-follow-up-todo.md`.

## Decision Drivers

- Avoid publishing new unfinished content to production by default.
- Preserve current public-site visibility for most existing non-archived content during migration.
- Separate production/publication intent from reader-facing editorial maturity.
- Provide GM/spoiler warnings without creating a false security boundary.
- Keep campaign `visibility` as the only content-frontmatter access-control field.
- Replace overloaded legacy terminology with clear author-facing field names.
- Maintain portable source contracts: Obsidian is preferred, but any tool may produce valid Markdown/frontmatter/link/media inputs.

## Considered Options

### Option 1: Keep legacy `status` semantics

Continue using `status: draft | publish | published | archive | archived` as the primary field.

**Pros**

- Lowest immediate implementation cost.
- Preserves current behavior without migration.

**Cons**

- Keeps publication eligibility, editorial maturity, and archive behavior overloaded.
- New entries can still be production-visible by accident.
- Keeps confusing legacy vocabulary in authoring templates.

### Option 2: Reinterpret `status` as the new publication lane

Keep the field name `status`, but redefine values to mean publication lane and archive behavior.

**Pros**

- Smaller schema diff.
- Familiar field name for existing authors.

**Cons**

- Preserves historical ambiguity around “draft” and “status”.
- Makes migration harder to reason about because old and new meanings share the same key.
- Does not provide a clean place for reader-facing maturity labels.

### Option 3: Introduce separate `publication`, `contentState`, and `audienceWarnings` fields (Chosen)

Use three explicit fields: one for publication lane, one for reader-facing editorial maturity, and one for label-only audience warnings.

**Pros**

- Clear semantics for authors, validation, runtime filters, sync tooling, and UI.
- New content can default safely to preview-only.
- Published-but-provisional content can still appear with a visible maturity label.
- GM/spoiler warnings can be rendered without implying authorization.

**Cons**

- Requires schema, template, UI, sync, and content migration work.
- Requires a migration window where legacy `status` remains understood.

## Decision Outcome

Chosen option: Option 3 — introduce separate `publication`, `contentState`, and `audienceWarnings` fields.

### Policy

1. `publication` is the authoritative field for publication lane and archive behavior.
2. Initial allowed `publication` values are:
   - `preview` — not production-publishable; intended for local/staging/editorial preview lanes.
   - `publish` — production-publishable.
   - `archive` — retired from normal public discovery/listing unless an explicit archive surface is later designed.
3. `contentState` is a reader-facing editorial maturity label only.
4. Initial allowed `contentState` values are:
   - `stable` — no special provisional label required.
   - `mayChange` — content is visible but likely to change.
   - `unfinished` — content is intentionally visible but incomplete.
5. `audienceWarnings` is an array of reader-facing warning labels only.
6. Initial allowed `audienceWarnings` value is:
   - `gmSpoilers` — indicates likely GM/spoiler-oriented material, but does not restrict access.
7. `gmSpoilers` is never an authorization mechanism. It must not be used to protect content, hide content from unauthorized users, or replace campaign `visibility` checks.
8. Campaign access remains controlled only by:
   - Better Auth identity/session,
   - D1 `campaign_memberships` with role `member | gm`,
   - campaign content `visibility: public | campaignMembers | gm`.
9. Deprecated `secret` remains ignored for access control and must not be revived as a field name, concept, warning label, or security boundary.
10. Existing `status` frontmatter is legacy input during migration only. New author-facing templates and validation messages should steer authors to `publication`, `contentState`, and `audienceWarnings`.

### Migration Policy

1. Existing `status: archive | archived` maps to `publication: archive`.
2. Existing non-archive content generally maps to `publication: publish` to preserve the currently visible public site.
3. Existing uncertainty should be represented with `contentState`, not by hiding large amounts of current content from production.
4. Existing `status: draft | review | publish | published` should be reviewed during migration, but the default migration posture is production continuity unless a concrete reason exists to mark the entry `publication: preview`.
5. New content templates default to:
   - `publication: preview`,
   - `contentState: unfinished` or another explicit author-selected state,
   - `audienceWarnings: []` unless a warning is warranted.
6. After the migration window closes, missing `publication` on new-style content is invalid.
7. During the migration window, runtime and sync code may derive `publication` from legacy `status`, but that compatibility path is temporary and should be removed after content/templates are migrated.

## Consequences

### Positive

- Publication intent becomes explicit and safer by default for new content.
- Existing public content remains broadly visible after migration.
- Visible provisional content can be labelled without being hidden.
- GM/spoiler notices become clearer while avoiding false security semantics.
- `secret` remains deprecated rather than being reintroduced under another access-control meaning.

### Negative

- Migration touches schema, sync, content, templates, cloud indexes, UI, and tests.
- Temporary compatibility with legacy `status` increases short-term complexity.
- Existing content must be reviewed to distinguish publication lane from editorial maturity.

### Neutral

- This does not change ADR-0001 source-of-truth behavior.
- This does not change ADR-0010 cloud-default runtime behavior.
- This does not change ADR-0016 D1-as-index and R2-as-blob-storage policy.
- This does not change ADR-0019 campaign authorization semantics.
- This does not move privileged admin workflows into the public site and does not change ADR-0021.

## Acceptance Criteria

1. `publication`, `contentState`, and `audienceWarnings` are defined unambiguously.
2. Existing non-archived content migration preserves the current public site broadly by mapping most content to `publication: publish`.
3. New templates default content to `publication: preview`.
4. `gmSpoilers` is explicitly label-only and never authorization.
5. Campaign `visibility` remains separate from publication and warning semantics.
6. Deprecated `secret` remains ignored for access control and is not reused for this model.
7. Operational consequences are cross-referenced to existing runtime, storage/index, and crawler ADRs rather than being owned by this metadata-model ADR.

## Links

- Source plan: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`
- Superseded policy: `plans/draft-visibility-follow-up-todo.md`
- Related ADR: `plans/adrs/0001-obsidian-first-content-architecture.md`
- Related ADR: `plans/adrs/0010-global-content-source-mode-cloud-default.md`
- Related ADR: `plans/adrs/0015-seo-and-crawler-governance-policy.md`
- Related ADR: `plans/adrs/0016-d1-as-canonical-cloud-content-index-and-r2-blob-storage.md`
- Related ADR: `plans/adrs/0019-campaign-membership-role-unification.md`
- Related ADR: `plans/adrs/0021-external-admin-capability-boundary.md`
