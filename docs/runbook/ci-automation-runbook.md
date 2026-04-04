# CI Automation Runbook

## Overview

This document describes the CI pipeline, how to trigger it, and how to extend it as automation matures.

## Current State

**Status:** Manual trigger only

The CI workflow at `.github/workflows/ci.yml` is version-controlled and ready to extend. It is currently gated behind `workflow_dispatch` and does not run on every push. This avoids burning GitHub Actions minutes during the high-frequency push phase of trunk-based development.

## Triggering CI Manually

### Via GitHub CLI

```bash
gh workflow run ci.yml
```

### Via GitHub Web UI

1. Go to the repository on GitHub.
2. Navigate to the **Actions** tab.
3. Select **CI** from the workflow list.
4. Click **"Run workflow"** and pick the branch.

## Workflow Contents

The CI lane currently runs:

1. `pnpm install --frozen-lockfile` — dependency installation
2. `pnpm test` — full test suite
3. `pnpm build` — Astro site build

## Extending to Automated Deploy

Once deployment automation is added, the workflow will be extended to run on push to `main` and include a `wrangler deploy` step. Required secrets:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers deploy permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

When to switch from manual-only to automated:

- Push frequency to `main` has decreased (multiple times per day → a few times per week)
- Automated smoke tests in CI are verified to be trustworthy
- A rollback plan for failed deploys is documented

## Transition Plan (Trunk-Based Dev)

1. Currently: all pushes are local `wrangler deploy` — no CI automation.
2. Short-term: use `workflow_dispatch` to manually verify CI lane before significant deploys.
3. Medium-term: add `wrangler deploy --dry-run` to CI to catch bundling/config issues remotely.
4. Long-term: full `wrangler deploy` on push to `main` with manual rollback capability.

## Adding Secrets to GitHub

1. Go to the repository **Settings** → **Secrets and variables** → **Actions**.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Reference them in the workflow:

```yaml
- name: Deploy to Cloudflare Workers
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: wrangler deploy
```
