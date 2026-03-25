# Content Ingestion User Guide

This guide explains how to run the Obsidian-to-repo ingestion scripts in a simple, repeatable way.

## What this workflow does

The command in [`scripts/content-sync/index.mjs`](scripts/content-sync/index.mjs) does this sequence:

1. Compare Obsidian folders to mapped repo folders
2. Show a dry-run report
3. Ask what to do with stale files (`remove`, `backup`, or `abort`)
4. Copy/update files
5. Normalize Obsidian wiki syntax in Markdown (for `src/content/**` mappings):
   - `[[Page Name]]` -> standard Markdown link with resolved site route
   - `![[Image Name.png]]` -> standard Markdown image link targeting `src/assets/images`
6. Publish/update R2 manifests for cloud-backed collections
7. Reconcile the public D1 discovery index (`content_index`) from manifest identity + frontmatter metadata
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

### 4) Optional: sync campaign content to Cloudflare R2

Use this when you want campaign files to publish to R2 instead of `src/content/campaigns`.

Campaign authoring and slug-rename conventions live in [`docs/runbook/campaign-authoring-and-rename.md`](docs/runbook/campaign-authoring-and-rename.md).

Campaign source folders should use this family-based shape:

```text
<campaign-slug>/
  index.md
  sessions/
  lore/
  places/
  sentients/
  bestiary/
  flora/
  factions/
  systems/
  meta/
  characters/
  scenes/
  adventures/
  hooks/
```

1. Create a bucket (example bucket name):

```bash
pnpm wrangler r2 bucket create woa-campaign-private
pnpm wrangler r2 bucket list
```

2. In `config/content-sync.config.json`, mark the campaign mapping as cloud-targeted and set `campaignCloud.bucket` to the exact same bucket name:

```json
{
  "mappings": [
    { "from": "World/Campaigns", "to": "campaigns", "target": "cloud" }
  ],
  "campaignCloud": {
    "bucket": "woa-campaign-private",
    "accountId": "<your-cloudflare-account-id>",
    "accessKeyIdEnv": "R2_ACCESS_KEY_ID",
    "secretAccessKeyEnv": "R2_SECRET_ACCESS_KEY"
  }
}
```

3. Generate R2 S3 credentials in Cloudflare Dashboard:
   - Go to **R2 object storage** -> **Manage R2 API tokens**.
   - Create an R2 token scoped to the bucket (object read/write).
   - Copy both values shown after creation:
     - Access Key ID
     - Secret Access Key

   This sync script uses an S3 client, so it needs this key pair. A single generic Cloudflare API token string is not enough for this flow.

4. Export the key pair in your shell before sync:

```bash
export R2_ACCESS_KEY_ID="<access-key-id>"
export R2_SECRET_ACCESS_KEY="<secret-access-key>"
```

5. Verify:

```bash
pnpm content:sync:dry-run
```

### 5) Optional: choose the D1 content-index sync target

`pnpm content:sync` now updates the `content_index` D1 table after manifest generation.

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

Run the migration plan first in the matching environment so `content_index` exists before sync writes begin.

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
pnpm content:validate
```

### Campaign slug rename helper

```bash
pnpm campaign:rename -- --from=old-campaign-slug --to=new-campaign-slug
```

Use `--dry-run` first for a no-write preview.

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
- Protected campaign rows are intentionally excluded from the public `content_index`; only `visibility: public` campaign-domain entries are written there.
- If private campaign content ever existed in Git history, history sanitization is still a separate operator task. Sync/index changes do not rewrite existing Git history.
