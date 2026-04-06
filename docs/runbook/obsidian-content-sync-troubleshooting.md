# Runbook: Obsidian Parsing & Ingestion Failures (Content Sync)

This runbook is an operator-facing troubleshooting guide for ingestion failures in [`scripts/content-sync/index.mjs`](../../scripts/content-sync/index.mjs), with specific focus on frontmatter/tag parsing in [`scripts/content-sync/validate.mjs`](../../scripts/content-sync/validate.mjs).

## Common symptoms

- `invalid tags format ...`
- `missing frontmatter block`
- `malformed frontmatter delimiters`
- `no such table: content_index`
- `wrangler d1 execute DB ...` fails during sync
- validation fails during [`pnpm content:validate`](../../package.json:13)
- regressions after parser/normalization changes

## Deterministic diagnosis flow

### 1) Quick health check

Run:

```bash
pnpm content:validate
```

Interpretation:

- **Pass**: validator accepts current content set.
- **Fail with file path(s)**: inspect listed markdown files first.

### 2) Verify parser/normalization behavior via tests

Run:

```bash
pnpm test scripts/content-sync/validate.test.mjs
```

Interpretation:

- **Pass**: parser + normalization behavior is consistent with expected tag shapes.
- **Fail**: inspect failing test case to identify whether issue is in frontmatter parsing, normalization, or strict invalid-case handling.

### 2b) Verify D1 discovery-index prerequisites

If sync fails while collecting D1 lookup rows or writing the D1 index:

1. Apply migrations in the matching target first:

```bash
pnpm db:migrate:plan:local
```

or, for staging parity:

```bash
pnpm db:migrate:plan:staging
```

2. Confirm the sync target matches the database you migrated:

- local default: no extra env vars
- staging remote: `CONTENT_INDEX_SYNC_MODE=remote CONTENT_INDEX_SYNC_ENV=staging`
- production remote: `CONTENT_INDEX_SYNC_MODE=remote`

3. Re-run the authoritative parity lane when checking cloud-backed behavior:

```bash
pnpm dev:cf
```

### 3) Confirm frontmatter delimiter integrity

In failing file, confirm:

- first non-whitespace line is `---`
- closing `---` exists
- no accidental nested delimiter in frontmatter block

This maps to [`parseFrontmatter()`](../../scripts/content-sync/validate.mjs:76).

### 4) Distinguish tag-shape failure classes

#### A. YAML list parsing issue

Valid Obsidian shape:

```yaml
tags:
  - money
  - copper
```

Expected behavior:

- parsed as array in [`parseFrontmatter()`](../../scripts/content-sync/validate.mjs:76)
- normalized by [`normalizeObsidianTags()`](../../scripts/content-sync/validate.mjs:45)
- validation passes

If this fails, inspect list indentation and dash syntax.

#### B. Delimiter/format edge case

Potentially invalid examples:

```yaml
tags: [money, copper
```

```yaml
---
title: X
tags:
  - money
# missing closing ---
```

Expected behavior:

- malformed/mismatched bracket formats should fail (strictly)
- malformed frontmatter delimiters should fail

#### C. Inline hashtag extraction behavior

Example body:

```md
Currency is discussed with #money and #copper.
```

Expected behavior:

- inline tags are extracted by [`extractInlineHashtags()`](../../scripts/content-sync/validate.mjs:7)
- merged/deduped with frontmatter tags in [`normalizeObsidianTags()`](../../scripts/content-sync/validate.mjs:45)

#### D. Normalization mismatch

Supported valid inputs include:

- YAML list (`tags:` + `- item`)
- scalar string (`tags: money`)
- comma-separated scalar (`tags: money, copper`)
- bracket style (`tags: [money, #copper]`)

Expected canonical output:

- stable array
- trimmed
- deduplicated
- lowercased

## Valid vs invalid examples

### Valid (should pass)

```yaml
tags:
  - money
  - copper
```

```yaml
tags: money, copper
```

```yaml
tags: "money"
```

```yaml
tags: [money, #copper, "coinage"]
```

### Invalid (should fail)

```yaml
tags: [money, copper
```

```yaml
tags: ]
```

```yaml
tags: {
```

## Safe remediation steps

1. Keep content shape Obsidian-compatible first (prefer YAML list for clarity).
2. If failures occur, normalize to one of the valid formats above.
3. Re-run:

```bash
pnpm content:validate
pnpm test scripts/content-sync/validate.test.mjs
```

4. Only relax validation when input is genuinely valid and backward-compatible; do not accept malformed delimiters or ambiguous bracket syntax.

## Prevention (regression expectations)

When changing parser/normalization logic in [`scripts/content-sync/validate.mjs`](../../scripts/content-sync/validate.mjs):

- update/add cases in [`scripts/content-sync/validate.test.mjs`](../../scripts/content-sync/validate.test.mjs)
- include at minimum:
  - failing-case regression test
  - 2+ additional valid tag shapes
  - 1 strict invalid case
  - content-index writer/query coverage when lookup-key or visibility contracts change
- run both:

```bash
pnpm test scripts/content-sync/content-index-writer.test.mjs
pnpm test scripts/content-sync/validate.test.mjs
pnpm content:validate
```

No parser behavior change should be merged without test updates proving backward compatibility.
