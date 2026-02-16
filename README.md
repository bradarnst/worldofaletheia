# Astro Starter Kit: Minimal

```sh
pnpm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Content Sync Workflow (Obsidian -> Repo)

This project now includes a standalone cross-platform Node.js sync flow for moving Obsidian-authored content into [`src/content`](src/content).

### One-time setup

1. Copy [`config/content-sync.config.example.json`](config/content-sync.config.example.json) to `config/content-sync.config.json`.
2. Edit `vaultRoot` in `config/content-sync.config.json`.
3. Keep mappings pointing only to `src/content/*` folders.

`config/content-sync.config.json` is ignored by git to keep personal local paths private.

### Main command

- `pnpm content:sync`

What it does:
1. Pull latest repo changes (`git pull --ff-only`)
2. Dry-run style diff report (new/updated/stale/unchanged)
3. If stale files exist, asks you to choose:
   - `remove` (delete stale repo files)
   - `backup` (move stale files to `.content-sync-backups/`)
   - `abort` (stop safely)
4. Apply sync changes
5. Validate frontmatter + markdown quality
6. Commit and push

### Helper commands

- `pnpm content:sync:dry-run` -> analyze only, no file changes
- `pnpm content:validate` -> run validation only
- `pnpm content:git` -> pull/commit/push only

### Prompt style and troubleshooting

Messages are short and non-technical, with a support code when something fails:

- What happened
- Action to take now
- Support code

Example support codes include:
- `CONFIG-MISSING`
- `GIT-PULL-DIVERGED`
- `VALIDATION-FAILED`
- `SYNC-RUNTIME-ERROR`

For extra technical details during troubleshooting, run with:

- Linux/macOS: `CONTENT_SYNC_DEBUG=1 pnpm content:sync`
- PowerShell: `$env:CONTENT_SYNC_DEBUG='1'; pnpm content:sync`
