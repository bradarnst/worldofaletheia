# Obsidian Templater Frontmatter Templates Handoff

Date: 2026-06-19
Status: Ready for code handoff
Scope: Update active Obsidian Templater templates in `/home/brad/gaming/aletheia-vault/z_Templates`.

## Goal

Refresh the active Obsidian Templater templates so newly authored vault notes emit current, useful, schema-aligned frontmatter by default.

Use the preferred hybrid template pattern:

- `default-template.md`
- `canon-template.md`
- `using-template.md`
- `campaign-template.md` or an updated `campaign-canon-template.md`
- `contributor-template.md`

Each template should be smart enough to prompt for key values and emit valid collection-specific frontmatter. Do not create one physical template per collection unless later Obsidian workflow friction proves the smart-template approach too awkward.

## Architectural Grounding

Follow the accepted project decisions:

- ADR-0001: Obsidian remains the preferred authoring source flow.
- ADR-0024: new content uses explicit publication metadata.
- ADR-0025: frontmatter is authoritative for machine-readable content facts.
- Campaign authorization remains `visibility` plus Better Auth/D1 membership; `audienceWarnings` is label-only.

## Required Template Defaults

New content templates must emit:

```yaml
publication: preview
contentState: unfinished
audienceWarnings: []
```

Templates must stop emitting:

```yaml
status: draft
secret: ...
```

`status` is legacy migration input only. `secret` is deprecated and ignored for access control.

## Current Template Problems to Fix

The active templates currently have these issues:

1. They emit legacy `status: draft` instead of `publication`, `contentState`, and `audienceWarnings`.
2. They emit `authors` as a scalar, while current content uses a YAML list.
3. They omit `tags`, `parentChain`, and `relationships` scaffolding.
4. They omit a contributor profile template entirely.
5. They can emit blank/undefined title when the note title is not `Untitled`.
6. `using-template.md` has invalid Templater syntax in the collection suggester value array.
7. They do not guide collection-specific type/subtype selection from the current enums.

## General Implementation Requirements

For every active template:

1. Preserve the current file title when it is not `Untitled`; prompt and rename only for untitled notes.
2. Emit `title` from the resolved final title.
3. Emit `authors` as a YAML list.
4. Prompt for author from known contributor IDs initially: `Brad`, `Barry`.
5. Prefer `tp.system.multi_suggester` if adding multi-author selection is low-friction.
6. Emit `tags: []` by default.
7. Emit `publication: preview` by default.
8. Emit `contentState: unfinished` by default, ideally using a suggester with `unfinished`, `mayChange`, `stable`.
9. Emit `audienceWarnings: []` by default, with optional `gmSpoilers` selection where useful.
10. Use Templater `suggester` for known enums.
11. Keep optional complex fields as valid empty arrays or omitted/commented examples; never emit broken YAML.
12. Do not rely on folder placement alone for `collection`, `type`, `campaign`, or publication metadata.

## Suggested Shared Templater Shape

Each smart template can follow this internal pattern:

```javascript
<%*
let title = tp.file.title;
if (title.startsWith("Untitled")) {
  const promptedTitle = await tp.system.prompt("Enter note title", "", true);
  title = promptedTitle.trim();
  await tp.file.rename(title);
}

const author = await tp.system.suggester(["Brad", "Barry"], ["Brad", "Barry"], false, "Author", undefined, "Brad");
const contentState = await tp.system.suggester(
  ["unfinished", "mayChange", "stable"],
  ["unfinished", "mayChange", "stable"],
  false,
  "Content state",
  undefined,
  "unfinished",
);
%>
```

Then render YAML from the prompted values. Keep helper logic local to each template unless a later Obsidian-side user-script pattern is deliberately introduced.

## Canon Template

File: `/home/brad/gaming/aletheia-vault/z_Templates/canon-template.md`

### Collections Covered

- `lore`
- `places`
- `sentients`
- `bestiary`
- `flora`
- `factions`

### Type Values

Use current values from `src/lib/content-types.ts`:

- `lore`: `cosmology`, `religion`, `economy`, `history`, `geography`, `food-drink`, `culture`, `language`, `warfare`, `domestication`, `magic`, `technology`, `structure`, `other`, `event`
- `places`: `location`, `landmark`, `dungeon`, `settlement`, `region`, `country`, `territory`, `water`, `biome`, `dimension`, `world`
- `sentients`: `race`, `species`, `culture`, `organization`, `deity`
- `bestiary`: `monster`, `animal`, `undead`, `spirit`, `construct`, `elemental`
- `flora`: `tree`, `flower`, `fungus`, `herb`, `fruit`, `plant`, `crop`
- `factions`: `political`, `guild`, `criminal`, `government`, `religion`, `military`, `police`, `school`, `order`

### Required Frontmatter Shape

```yaml
---
title: <resolved title>
layer: canon
collection: <collection>
type: <type>
authors:
  - <author>
excerpt:
tags: []
created: <YYYY-MM-DD HH:mm>
modified: <YYYY-MM-DD HH:mm>
publication: preview
contentState: <unfinished|mayChange|stable>
audienceWarnings: []
parentChain: []
relationships: []
---
```

### Conditional Fields

- If `collection: lore` and `type: event`, prompt for:
  - `aletheia_date`
  - optional `aletheia_date_end`
- If `collection: places`, optionally scaffold coordinates as a commented example or omit by default:
  ```yaml
  # coordinates:
  #   x: 0
  #   y: 0
  ```
- If `collection: sentients` or `collection: factions`, optionally prompt for `alignment` from:
  - `lawful`, `neutral`, `chaotic`, `good`, `evil`, `any`
- If `collection: bestiary`, optionally prompt for `challengeRating` or omit.

Recommended default: keep optional fields omitted unless the author explicitly enters/selects a value.

## Using Template

File: `/home/brad/gaming/aletheia-vault/z_Templates/using-template.md`

### Collections Covered

- `systems`
- `meta`

### Type/Subtype Values

For `systems`:

- `type`: `general`, `gurps`
- `subtype`: `magic`, `combat`, `skill`, `language`, `character`, `economy`, `social`, `equipment`

For `meta`:

- `type`: `info`, `technical`, `content`, `reference`, `governance`, `characterCreation`
- no required `subtype`

### Required Frontmatter Shape

```yaml
---
title: <resolved title>
layer: using
collection: <systems|meta>
type: <type>
subtype: <subtype if systems>
authors:
  - <author>
excerpt:
tags: []
created: <YYYY-MM-DD HH:mm>
modified: <YYYY-MM-DD HH:mm>
publication: preview
contentState: <unfinished|mayChange|stable>
audienceWarnings: []
parentChain: []
relationships: []
---
```

Fix the existing invalid Templater syntax in the current `using-template.md` collection suggester.

## Campaign Template

Preferred file: `/home/brad/gaming/aletheia-vault/z_Templates/campaign-template.md`

If minimizing file churn matters more, update the current `campaign-canon-template.md` instead, but broaden its scope and consider renaming later.

### Collections Covered

- `campaigns`
- `sessions`
- `campaignLore`
- `campaignPlaces`
- `campaignSentients`
- `campaignBestiary`
- `campaignFlora`
- `campaignFactions`
- `campaignSystems`
- `campaignMeta`
- `campaignCharacters`
- `campaignScenes`
- `campaignAdventures`
- `campaignHooks`

### Campaign Slug Handling

Prompt for campaign slug. If feasible, default from folder path:

- `campaigns/brad/...` -> `brad`
- `campaigns/barry/...` -> `barry`

Frontmatter remains authoritative. The folder-derived slug is only a prompt default.

### Visibility Handling

Prompt for `visibility` from:

- `campaignMembers`
- `gm`
- `public`

Recommended defaults:

- `campaigns`: `public`
- `sessions`: `campaignMembers`
- `campaignHooks`: `gm`
- `campaignScenes`: `gm` when uncertain
- other campaign-family content: `campaignMembers`

### Required Frontmatter Shape for Campaign Overview

```yaml
---
title: <resolved title>
layer: campaigns
collection: campaigns
type: campaign
authors:
  - <author>
visibility: public
excerpt:
tags: []
created: <YYYY-MM-DD HH:mm>
modified: <YYYY-MM-DD HH:mm>
publication: preview
contentState: <unfinished|mayChange|stable>
audienceWarnings: []
parentChain: []
relationships: []
---
```

Note: current historical campaign overview content uses campaign-specific `type` values like `brad` or `barry`, but the current schema defaults `campaigns.type` to `campaign`. New templates should use `type: campaign` unless a specific reason exists to preserve campaign slug as type.

### Required Frontmatter Shape for Nested Campaign Content

```yaml
---
title: <resolved title>
layer: campaigns
collection: <campaign collection>
type: <type>
campaign: <campaign slug>
visibility: <public|campaignMembers|gm>
authors:
  - <author>
excerpt:
tags: []
created: <YYYY-MM-DD HH:mm>
modified: <YYYY-MM-DD HH:mm>
publication: preview
contentState: <unfinished|mayChange|stable>
audienceWarnings: []
parentChain: []
relationships: []
---
```

### Campaign Type Values

Use canonical type values from `src/lib/content-types.ts`.

Campaign-family collections mirror Canon/Using values where applicable:

- `campaignLore`: same as `lore`
- `campaignPlaces`: same as `places`
- `campaignSentients`: same as `sentients`
- `campaignBestiary`: same as `bestiary`
- `campaignFlora`: same as `flora`
- `campaignFactions`: same as `factions`
- `campaignSystems`: same as `systems`, with systems `subtype`
- `campaignMeta`: same as `meta`

Campaign-specific collections:

- `sessions`: `session`, `encounter`, `battle`, `note`
- `campaignCharacters`: `pc`, `npc`, `ally`, `adversary`, `patron`, `creature`, `group`, `other`, `relationship`
- `campaignScenes`: `scene`, `combat`, `social`, `travel`, `downtime`, `investigation`, `flashback`, `other`
- `campaignAdventures`: `arc`, `mission`, `quest`, `contract`, `dungeon`, `journey`, `heist`, `other`
- `campaignHooks`: `rumor`, `lead`, `job`, `threat`, `mystery`, `opportunity`, `other`

### Conditional Fields

- `sessions`: optionally prompt for `date` and `duration`.
- `campaignScenes`: optionally prompt for `date`.
- `campaignAdventures`: optionally prompt for `date`.
- `campaignSystems`: require `subtype` from the systems subtype enum.
- `campaignPlaces`: optionally support `coordinates`.
- `campaignCharacters` inherits sentient-like fields but uses campaign character type enum.

## Contributor Template

New file: `/home/brad/gaming/aletheia-vault/z_Templates/contributor-template.md`

### Required Frontmatter Shape

```yaml
---
title: <resolved title>
displayName: <resolved title>
collection: contributors
aliases: []
publication: preview
contentState: unfinished
audienceWarnings: []
avatar:
bioExcerpt:
socials: []
profileMode: <standard|featured>
featuredContributions: []
---
```

The current `contributors` schema does not require `authors`. Existing contributor profiles include it, but code handoff should either:

1. keep `authors` in contributor templates for consistency with vault practice, or
2. omit it for strict schema minimalism.

Recommended implementation: keep `authors` as a YAML list for authoring provenance because existing contributor profiles already do this and validation accepts extra frontmatter.

```yaml
authors:
  - <author>
```

## Default Template

File: `/home/brad/gaming/aletheia-vault/z_Templates/default-template.md`

Purpose: fallback/general-purpose smart entry template.

Recommended behavior:

1. Prompt for layer: `canon`, `using`, `campaigns`, `contributors`.
2. Based on layer, either:
   - emit the same logic as the matching template, or
   - instruct the author to use the matching dedicated template.

Recommended implementation for first pass: make `default-template.md` a safe generic article template that prompts for `layer`, `collection`, and `type`, and emits valid publication metadata. It does not need every collection-specific optional field if the domain-specific templates cover the richer paths.

## Relationship and Parent Chain Scaffolding

`parentChain` and `relationships` are core product concerns. Templates should make them visible without forcing authors to fill them immediately.

Recommended default:

```yaml
parentChain: []
relationships: []
```

Acceptable richer commented example:

```yaml
# parentChain:
#   - label: Parent Page
#     href: /places/parent-page
# relationships:
#   - label: Related Page
#     href: /lore/related-page
#     kind: connectedTo
#     reason: Brief relationship note
```

Prefer valid empty arrays in emitted YAML and place examples below the frontmatter if comments create Obsidian ergonomics problems.

## Audience Warning Handling

`audienceWarnings` supports only:

- `gmSpoilers`

It is label-only. It must never be described as privacy, security, or access control.

Recommended template UX:

- Default to `audienceWarnings: []`.
- For Campaign templates, optionally ask: “Add GM spoiler warning?”
- If yes, emit:
  ```yaml
  audienceWarnings: [gmSpoilers]
  ```

## Validation Commands

After implementation, run from `/home/brad/gaming/worldofaletheia`:

```bash
pnpm content:sync:validate
```

Recommended additional checks:

```bash
pnpm test -- scripts/content-sync/validate.test.mjs
pnpm content:publication:migration:plan
```

Manual Obsidian validation:

1. Create one new note from each active template.
2. Verify prompts work and no prompt returns `null` into YAML.
3. Verify generated YAML parses in Obsidian properties view.
4. Place generated notes in expected vault folders and run sync validation.
5. Confirm generated notes contain no `status` or `secret`.
6. Confirm generated `authors`, `tags`, `audienceWarnings`, `parentChain`, and `relationships` are valid YAML arrays.

## Non-goals

- Do not edit `zz*` templates.
- Do not change `src/content.config.ts`.
- Do not change ADRs or publication policy.
- Do not add service, adapter, or contract layers.
- Do not implement inbox movement or propose-then-approve placement tooling in this slice.
- Do not introduce a shared Obsidian user-script library unless local duplication becomes painful after implementation.
- Do not create 20+ separate physical templates for every collection unless the hybrid pattern proves inadequate.

## Acceptance Criteria

1. Active templates no longer emit legacy `status`.
2. Active templates emit `publication`, `contentState`, and `audienceWarnings`.
3. Canon, Using, Campaign, and Contributor authoring flows are covered.
4. Collection/type/subtype values come from current schema enums.
5. Campaign templates emit `campaign` where schema requires it.
6. Campaign templates emit `visibility` separately from `audienceWarnings`.
7. `authors` is emitted as a YAML list.
8. Generated sample notes pass `pnpm content:sync:validate` when placed in expected mapped folders.
9. No `zz*` templates are modified.
