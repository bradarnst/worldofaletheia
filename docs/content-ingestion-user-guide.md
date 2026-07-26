# Content Ingestion User Guide

This guide explains how to run the Obsidian-to-repo ingestion scripts in a simple, repeatable way.

Related targeted refresh workflow:

- [`docs/runbook/sorcerer-spell-data-refresh.md`](docs/runbook/sorcerer-spell-data-refresh.md) for replacing the checked-in GURPS sorcerer spell dataset from a better source JSON file.

## What this workflow does

The command in [`scripts/content-sync/index.mjs`](scripts/content-sync/index.mjs) does this sequence:

1. Compare Obsidian folders to mapped repo folders
2. Show a dry-run report
3. Ask what to do with stale files (`remove`, `backup`, or `abort`)
4. Copy/update files
5. Normalize Obsidian wiki syntax in Markdown (for `src/content/**` mappings):
   - `[[Page Name]]` -> standard Markdown link with resolved site route
   - `![[Image Name.png]]` -> standard Markdown image link targeting `src/assets/images`
6. Upload/update cloud-backed content objects in R2
7. Reconcile the D1 `content_index` table from content identity + frontmatter metadata + `r2_key` lookup data
8. Validate Markdown/frontmatter (for content folders)

Git operations are intentionally **not** part of default ingestion. Commit/push is manual.

## Obsidian link/embed conversion behavior

During [`pnpm content:sync`](package.json), Markdown files under `src/content/**` are transformed to normalize Obsidian syntax before validation/build.

What is converted:

- `[[Some Article]]` -> `[Some Article](/collection/slug)` (route resolved from known content entries)
- `![[Some Image.png]]` -> `![Some Image](relative/path/to/src/assets/images/Some Image.png)`

Why this exists:

- Astro content rendering does not natively interpret Obsidian wikilink/embed syntax.
- Normalizing at sync-time ensures static pages render clickable links and image embeds consistently.

Operational note:

- Existing Markdown already in repo is normalized on the next sync run.
- If validation warns about remaining wiki syntax, run full sync again and confirm the file is part of a `src/content/**` mapping.

## One-time setup

### 1) Install dependencies

Run in project root:

```bash
pnpm install
```

### 2) Create your personal config

Copy [`config/content-sync.config.example.json`](config/content-sync.config.example.json) to `config/content-sync.config.json`.

Linux/macOS:

```bash
cp config/content-sync.config.example.json config/content-sync.config.json
```

PowerShell:

```powershell
Copy-Item config/content-sync.config.example.json config/content-sync.config.json
```

### 3) Edit your config

Open `config/content-sync.config.json` and set:

- `vaultRoot`: your local Obsidian vault path
- `mappings`: source vault folders (`from`) to repo folders (`to`)
- `includeExtensions`: file types to sync

Recommended repo structure:

- Markdown content -> `src/content/*`
- Images -> `src/assets/images/*`
- PDFs/docs -> `src/assets/docs/*`

Minimal example:

```json
{
  "vaultRoot": "C:/Users/you/Documents/ObsidianVault",
  "mappings": [
    { "from": "World/Lore", "to": "src/content/lore" },
    { "from": "World/Assets/Images", "to": "src/assets/images" },
    { "from": "World/Assets/Docs", "to": "src/assets/docs" }
  ],
  "includeExtensions": [".md", ".png", ".jpg", ".jpeg", ".webp", ".pdf"],
  "backupRoot": ".content-sync-backups",
  "staleFilePolicy": "prompt",
  "defaultCommitMessage": "chore(content): sync Obsidian content"
}
```

### 4) Campaign Content is not ingested by this workflow

Do not map campaign folders to `src/content/campaigns` or to a campaign R2 target. Live Campaign Content is owned by `woa-admin` and read through the server-to-server source boundary:

- root: `/campaigns/<campaign-slug>` from `pages/index`
- about: `/campaigns/<campaign-slug>/about` from `pages/about`
- notes: `/campaigns/<campaign-slug>/notes` and `/campaigns/<campaign-slug>/notes/<document-id>` from the generic `notes` collection
- assets: `/campaigns/<campaign-slug>/assets/<path>` from source paths under `assets/`

See [`docs/runbook/campaign-authoring-and-rename.md`](docs/runbook/campaign-authoring-and-rename.md) for the active authoring and slug-change boundary.

### 5) Optional: choose the D1 content-index sync target

`pnpm content:sync` now updates the `content_index` D1 table as the canonical cloud metadata + object-lookup source for cloud content. D1 is the only supported cloud lookup contract; R2 stores blobs only.

- Default target: local D1 (`wrangler d1 execute DB --local ...`)
- Remote staging target:

```bash
CONTENT_INDEX_SYNC_MODE=remote CONTENT_INDEX_SYNC_ENV=staging pnpm content:sync
```

- Remote production target:

```bash
CONTENT_INDEX_SYNC_MODE=remote pnpm content:sync
```

- Disable D1 index writes for a run:

```bash
CONTENT_INDEX_SYNC_MODE=off pnpm content:sync
```

Run the migration plan first in the matching environment so `content_index`, its collection-scoped identity constraints, and its `r2_key` column exist before sync writes begin.

If you build with `CONTENT_SOURCE_MODE=cloud`, the loader also needs to know which D1 target to read from:

- Local build/parity: `CONTENT_LOADER_D1_MODE=local`
- Remote staging build: `CONTENT_LOADER_D1_MODE=remote CONTENT_LOADER_D1_ENV=staging`
- Remote production build: `CONTENT_LOADER_D1_MODE=remote`

## Changing allowed content types

Treat changes to [`src/lib/content-types.ts`](../src/lib/content-types.ts) as an **elevated-privilege change**. Adding, modifying, or deleting type values changes repository-wide schema behavior, can affect sync/build outcomes, and should only be done by someone who is authorized to change the site taxonomy.

What changes automatically when you edit `src/lib/content-types.ts`:

- `src/content.config.ts` picks up the new enum values for Astro/Zod validation
- `src/lib/r2-content-loader.mjs` picks up the same values for cloud-loader type sanitization

### Safe workflow for adding new type values

Use this sequence when you are **adding** new allowed types and want to ingest matching Obsidian content right away:

```bash
pnpm build
pnpm content:sync:dry-run
pnpm content:sync
pnpm build
```

Notes:

- `pnpm build` before sync confirms the code change itself is valid.
- `pnpm content:sync:dry-run` previews what will be pulled from Obsidian.
- `pnpm content:sync` ingests the new Obsidian content.
- `pnpm build` after sync is the real end-to-end check that the synced content passes Astro/Zod validation.
- If the new type should have a custom icon, also update `src/components/site/SiteGlyph.astro`.

### Important validation limitation

`pnpm content:sync:validate` is helpful for frontmatter shape checks, but it is **not** the final authority for enum changes. It does not enforce the `z.enum(...)` membership from `src/content.config.ts`. For type changes, `pnpm build` is still the authoritative validation step.

### If you rename or remove types

Renames/removals are higher risk than additions. Before syncing, update any affected Obsidian frontmatter to the new values. Otherwise the next sync + build can fail because the content no longer matches the allowed enum set.

## Day-to-day commands

### Main command

```bash
pnpm content:sync
```

For authoritative cloud behavior, verify with the Cloudflare parity lane after sync:

```bash
pnpm dev:cf
```

### Safe preview only

```bash
pnpm content:sync:dry-run
```

### Validation only

```bash
pnpm content:sync:validate
```

## Stale file decision (important)

If a file exists in repo mapped folders but no longer exists in Obsidian, script asks:

- `remove` → delete stale repo file permanently
- `backup` → move stale file into `.content-sync-backups/`
- `abort` → stop safely with no destructive action

## Troubleshooting (support codes)

When something fails, messages are intentionally short and include a support code.

Detailed operator runbook for parser/ingestion issues:

- [`docs/runbook/obsidian-content-sync-troubleshooting.md`](docs/runbook/obsidian-content-sync-troubleshooting.md)
- [`docs/runbook/campaign-authoring-and-rename.md`](docs/runbook/campaign-authoring-and-rename.md)

| Support code | Meaning | Recovery action |
|---|---|---|
| `CONFIG-MISSING` | `config/content-sync.config.json` not found | Copy example config and set `vaultRoot` |
| `CONFIG-JSON-INVALID` | Config JSON has syntax error | Fix JSON format and retry |
| `VALIDATION-FAILED` | Markdown/frontmatter validation failed | Fix listed files, rerun sync |
| `SYNC-STALE-ABORTED` | User chose abort at stale prompt | Re-run and choose remove or backup |
| `SYNC-RUNTIME-ERROR` | General runtime failure, including R2/D1 publish failures | Re-run with debug, verify migrations, inspect the exact wrangler/R2 error |

## Discovery index scope

- The repo content-sync `content_index` covers mapped repo-owned collections.
- Live Campaign Content and its protected metadata are resolved through `woa-admin`, not inserted into this repo's index by `pnpm content:sync`.

## Debug mode for technical details

Linux/macOS:

```bash
CONTENT_SYNC_DEBUG=1 pnpm content:sync
```

PowerShell:

```powershell
$env:CONTENT_SYNC_DEBUG='1'; pnpm content:sync
```

## Notes

- `config/content-sync.config.json` is local and git-ignored.
- Backup folder `.content-sync-backups/` is outside published content tree.
- Only folders in your config mappings are touched.
- Markdown validation applies to `src/content/**` mappings; binary asset mappings under `src/assets/**` are synced but not frontmatter-validated.
- `pnpm dev:cf` is the canonical discovery/index parity lane; plain `pnpm dev` remains the local convenience lane.
- Campaign Content is intentionally outside this repo ingestion/index lane.
- If private campaign content ever existed in Git history, history sanitization is still a separate operator task. Sync/index changes do not rewrite existing Git history.
