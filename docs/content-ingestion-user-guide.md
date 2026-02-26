# Content Ingestion User Guide

This guide explains how to run the Obsidian-to-repo ingestion scripts in a simple, repeatable way.

## What this workflow does

The command in [`scripts/content-sync/index.mjs`](scripts/content-sync/index.mjs) does this sequence:

1. Pull latest remote changes
2. Compare Obsidian folders to mapped repo folders
3. Show a dry-run report
4. Ask what to do with stale files (`remove`, `backup`, or `abort`)
5. Copy/update files
6. Normalize Obsidian wiki syntax in Markdown (for `src/content/**` mappings):
   - `[[Page Name]]` -> standard Markdown link with resolved site route
   - `![[Image Name.png]]` -> standard Markdown image link targeting `src/assets/images`
6. Validate Markdown/frontmatter (for content folders)
7. Commit and push

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

## Day-to-day commands

### Main command

```bash
pnpm content:sync
```

### Safe preview only

```bash
pnpm content:sync:dry-run
```

### Validation only

```bash
pnpm content:validate
```

### Git stage only

```bash
pnpm content:git
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

| Support code | Meaning | Recovery action |
|---|---|---|
| `CONFIG-MISSING` | `config/content-sync.config.json` not found | Copy example config and set `vaultRoot` |
| `CONFIG-JSON-INVALID` | Config JSON has syntax error | Fix JSON format and retry |
| `GIT-PULL-DIVERGED` | Fast-forward pull failed | Stop and resolve git divergence before syncing |
| `GIT-WORKTREE-NOT-CLEAN` | Local changes block pull (if enabled) | Commit or stash local work |
| `VALIDATION-FAILED` | Markdown/frontmatter validation failed | Fix listed files, rerun sync |
| `SYNC-STALE-ABORTED` | User chose abort at stale prompt | Re-run and choose remove or backup |
| `SYNC-RUNTIME-ERROR` | General runtime failure | Re-run with debug and inspect details |

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
