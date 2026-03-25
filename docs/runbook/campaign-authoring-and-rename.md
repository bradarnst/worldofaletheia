# Runbook: Campaign Authoring and Slug Rename

This runbook documents the current Campaigns-domain authoring shape and the supported process for adding or renaming campaigns.

## Source of truth

- Campaign content is authored in the Obsidian vault, not directly in the repo.
- The campaign folder name is the canonical campaign slug.
- That slug drives:
  - Campaign routes (`/campaigns/<campaign-slug>/...`)
  - Campaign-family routes (`/campaigns/<campaign-slug>/lore/...`, `/campaigns/<campaign-slug>/characters/...`, etc.)
  - Session routes (`/campaigns/<campaign-slug>/sessions/...`)
  - Campaign manifest identity in R2
  - Campaign access lookups and membership references

## Campaign content shape

Under the Obsidian Campaigns source folder (for example `World/Campaigns`), organize each campaign like this:

```text
<campaign-slug>/
  index.md
  sessions/
    <session-slug>.md
  lore/
    <entry-slug>.md
  places/
    <entry-slug>.md
  sentients/
    <entry-slug>.md
  bestiary/
    <entry-slug>.md
  flora/
    <entry-slug>.md
  factions/
    <entry-slug>.md
  systems/
    <entry-slug>.md
  meta/
    <entry-slug>.md
  characters/
    <entry-slug>.md
  scenes/
    <entry-slug>.md
  adventures/
    <entry-slug>.md
  hooks/
    <entry-slug>.md
```

Notes:

- `index.md` is the campaign overview entry.
- Family folders map to explicit campaign-domain collections:
  - `lore` -> `campaignLore`
  - `places` -> `campaignPlaces`
  - `sentients` -> `campaignSentients`
  - `bestiary` -> `campaignBestiary`
  - `flora` -> `campaignFlora`
  - `factions` -> `campaignFactions`
  - `systems` -> `campaignSystems`
  - `meta` -> `campaignMeta`
  - `characters` -> `campaignCharacters`
  - `scenes` -> `campaignScenes`
  - `adventures` -> `campaignAdventures`
  - `hooks` -> `campaignHooks`
- Nested campaign content should keep `campaign: <campaign-slug>` in frontmatter.
- New campaigns no longer require a code edit in `src/content.config.ts`; the previous hardcoded `barry|brad` schema constraint has been removed.

## Adding a new campaign

1. Create a new campaign folder under the Obsidian Campaigns source root using the desired kebab-case slug.
2. Add `index.md` for the campaign overview.
3. Add any needed family folders (`sessions`, `lore`, `places`, `sentients`, `bestiary`, `flora`, `factions`, `systems`, `meta`, `characters`, `scenes`, `adventures`, `hooks`).
4. Set `campaign: <campaign-slug>` on nested entries.
5. Run:

```bash
pnpm content:sync
```

6. Verify routes locally with either:

```bash
pnpm dev
```

or, for cloud-backed parity:

```bash
pnpm dev:cf
```

## Renaming a campaign slug

Use the rename script from the repo root:

```bash
pnpm campaign:rename -- --from=old-campaign-slug --to=new-campaign-slug
```

Dry-run preview:

```bash
pnpm campaign:rename -- --from=old-campaign-slug --to=new-campaign-slug --dry-run
```

What the script updates:

- Renames the campaign folder in the configured Obsidian Campaigns source root.
- Rewrites nested Markdown frontmatter values from `campaign: old-campaign-slug` to `campaign: new-campaign-slug`.
- Updates `config/campaign-access.config.json` membership arrays and GM-assignment keys when that file exists.

What the script does not update:

- Remote D1 membership rows already applied outside the local seed/config flow.
- External links or hardcoded route strings outside the renamed campaign content.
- Redirect rules from the old slug to the new slug.

After the rename:

1. Run the content sync:

```bash
pnpm content:sync
```

2. If you use local auth parity data, reseed local memberships:

```bash
pnpm db:seed:memberships:local
```

3. Verify the new routes resolve and the old slug no longer appears where it should not.
4. Add redirects separately if you need old public links to keep working.

## Verification checklist

- Campaign overview route resolves at `/campaigns/<new-slug>`.
- Session routes resolve at `/campaigns/<new-slug>/sessions/...`.
- Family routes resolve at `/campaigns/<new-slug>/<family>/...`.
- Public campaign content appears under the new slug in discovery/search after sync.
- Membership/access config no longer references the old slug.

## Related docs

- `docs/content-ingestion-user-guide.md`
- `docs/runbook/campaign-access-local-dev.md`
- `docs/status-report-addendum-campaign-model-2026-03-24.md`
