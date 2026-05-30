import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeObsidianTags, validateContentTree } from './validate.mjs';

describe('normalizeObsidianTags', () => {
  it('accepts frontmatter YAML list values', () => {
    const result = normalizeObsidianTags({ frontmatterTags: ['money', ' copper '] });
    expect(result).toEqual({ ok: true, tags: ['copper', 'money'] });
  });

  it('accepts scalar string and comma-separated values', () => {
    expect(normalizeObsidianTags({ frontmatterTags: 'Money' })).toEqual({ ok: true, tags: ['money'] });
    expect(normalizeObsidianTags({ frontmatterTags: 'money, copper , #trade' })).toEqual({
      ok: true,
      tags: ['copper', 'money', 'trade'],
    });
  });

  it('accepts bracket arrays and merges inline hashtags', () => {
    const result = normalizeObsidianTags({
      frontmatterTags: '[money, #copper, "coinage"]',
      inlineTags: ['#trade', 'money'],
    });
    expect(result).toEqual({ ok: true, tags: ['coinage', 'copper', 'money', 'trade'] });
  });

  it('rejects truly invalid malformed bracket arrays', () => {
    const result = normalizeObsidianTags({ frontmatterTags: '[money, copper' });
    expect(result.ok).toBe(false);
  });
});

describe('validateContentTree tags compatibility', () => {
  it('accepts Obsidian-style multiline YAML tags list in frontmatter', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/lore');
    await fs.mkdir(contentRoot, { recursive: true });

    const markdown = `---
title: Copper Bit
type: economy
status: draft
authors:
  - brad
tags:
  - money
  - copper
---

Body text.`;

    await fs.writeFile(path.join(contentRoot, 'Copper Bit.md'), markdown, 'utf8');

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/lore' }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('accepts inline hashtags when tags frontmatter is absent', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/lore');
    await fs.mkdir(contentRoot, { recursive: true });

    const markdown = `---
title: Copper Bit
type: economy
status: draft
authors:
  - brad
---

Currency #money and #copper are discussed here.`;

    await fs.writeFile(path.join(contentRoot, 'Copper Bit.md'), markdown, 'utf8');

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/lore' }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('accepts contributor entries without type or authors requirements', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(contentRoot, { recursive: true });

    const markdown = `---
title: Brad
status: publish
displayName: Brad
profileMode: featured
---

Contributor profile body.`;

    await fs.writeFile(path.join(contentRoot, 'brad.md'), markdown, 'utf8');

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'contributors' }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });
});
