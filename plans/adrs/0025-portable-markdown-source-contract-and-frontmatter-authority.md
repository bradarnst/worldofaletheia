# Portable Markdown Source Contract and Frontmatter Authority

## Status

- Date: 2026-06-17
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

ADR-0001 established an Obsidian-first content architecture: content flows from authoring source to repository/build/deploy, not back from the public site into the authoring source. That decision remains correct for Canon and the static site content model.

Further roadmap planning clarified that “Obsidian-first” should not mean “Obsidian-exclusive.” Obsidian remains the preferred authoring UX, but the durable architectural boundary is the source contract: portable Markdown, required frontmatter, link/media conventions, and producer validation.

The project also needs to settle whether folder placement or frontmatter owns canonical metadata facts. Folders are useful for human organization and routing convenience, but frontmatter is the explicit machine-readable contract. Treating folders as canonical would weaken portability, make inbox-style authoring harder, and create drift when authoring tools differ.

## Decision Drivers

- Preserve Obsidian as the preferred writing environment without making it a hard product dependency.
- Keep content portable as Markdown plus YAML frontmatter.
- Make producer validation the enforcement boundary for content correctness.
- Avoid route and collection drift when folder placement conflicts with frontmatter.
- Support future inbox workflows where authors create files first and producer tooling proposes placement later.
- Preserve ADR-0001 one-way source flow for Canon and static content.

## Considered Options

### Option 1: Obsidian-specific source model

Define Obsidian vault structure and Obsidian behaviors as the canonical source model.

**Pros**

- Strongest fit for the current authoring UX.
- Simplest mental model for the current co-authors.

**Cons**

- Makes the architecture depend on one tool rather than a portable content contract.
- Makes future non-Obsidian authoring paths harder to validate.
- Blurs whether content correctness belongs to Obsidian conventions or producer validation.

### Option 2: Portable Markdown/frontmatter contract with frontmatter authority (Chosen)

Treat Obsidian as the preferred authoring tool, but make the Markdown/frontmatter/link/media contract authoritative. Frontmatter owns collection, type, campaign, publication, and related metadata. Folder placement is derived or validated against those facts.

**Pros**

- Preserves Obsidian ergonomics while avoiding tool lock-in.
- Gives producer validation a clear contract to enforce.
- Supports inbox and propose-then-approve placement workflows.
- Keeps schema and frontmatter as the source of machine-readable truth.

**Cons**

- Authors must maintain explicit frontmatter even when folder placement seems obvious.
- Producer tooling must detect and explain frontmatter/path mismatches clearly.

### Option 3: Folder/path authority with lighter frontmatter

Infer collection, campaign, type, and route facts primarily from folder hierarchy.

**Pros**

- Less frontmatter for authors in the simplest case.
- Familiar static-site convention.

**Cons**

- Couples source truth to current filesystem layout.
- Weakens portability across authoring tools.
- Makes inbox workflows awkward or impossible without hidden inference rules.
- Conflicts with existing schema-first validation direction.

## Decision Outcome

Chosen option: Option 2 — portable Markdown/frontmatter contract with frontmatter authority.

### Policy

1. Obsidian remains the preferred and optimized authoring UX, but it is not the exclusive source-authoring tool.
2. Any authoring tool is acceptable if it produces the required Markdown, YAML frontmatter, link, and media contract.
3. Frontmatter is authoritative for machine-readable content facts, including:
   - `collection`,
   - `type` and `subtype`,
   - `campaign` identity where applicable,
   - publication metadata from ADR-0024,
   - tags, relationships, and other schema-governed metadata.
4. Folder hierarchy remains useful for human organization, routing convenience, and default placement, but it is not the canonical authority when frontmatter defines the same fact.
5. Producer tooling must validate folder/path placement against frontmatter and fail or warn with actionable messages when they diverge.
6. Inbox-style authoring is allowed as producer tooling: authors may create files outside final placement and have a dry-run compute proposed destinations from frontmatter.
7. Inbox movement is propose-then-approve in v1. Valid files must not be silently moved by default.
8. Templates should optimize the Obsidian authoring experience, but validation must enforce the portable source contract rather than relying on Obsidian-only behavior.
9. This decision does not introduce bidirectional sync. Canon and static content remain one-way source-to-publish under ADR-0001.
10. Campaign live notes and any future cloud-first writable exception require a separate Campaigns-specific HLD/ADR before implementation.

## Consequences

### Positive

- The content model becomes portable without abandoning Obsidian ergonomics.
- Producer validation has a clear source contract to enforce.
- Future inbox and placement tooling can be built safely from frontmatter.
- Collection/type/campaign/publication facts remain explicit and queryable.

### Negative

- Frontmatter discipline becomes more important for authors.
- Producer validation and error messages need to be strong enough to prevent confusion.
- Some current docs that imply folder authority may need cleanup.

### Neutral

- ADR-0001 remains active: source content flows one way into publication outputs.
- This does not change D1/R2 runtime architecture under ADR-0016.
- This does not change Campaign authorization under ADR-0019.
- This does not decide live Campaign note storage or sync-back behavior.

## Acceptance Criteria

1. Obsidian is documented as preferred, not required.
2. Frontmatter is documented as the canonical metadata contract.
3. Folder hierarchy is documented as derived/validated placement rather than canonical authority.
4. Inbox movement is documented as propose-then-approve.
5. One-way source-to-publish flow remains intact for Canon and static content.
6. Campaign live notes are explicitly deferred to separate architecture work.

## Links

- Source plan: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`
- Related ADR: `plans/adrs/0001-obsidian-first-content-architecture.md`
- Related ADR: `plans/adrs/0012-content-producer-extraction-strategy.md`
- Related ADR: `plans/adrs/0016-d1-as-canonical-cloud-content-index-and-r2-blob-storage.md`
- Related ADR: `plans/adrs/0024-content-publication-metadata-model.md`
