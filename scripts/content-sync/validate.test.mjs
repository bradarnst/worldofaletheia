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
collection: lore
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
collection: lore
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

  it('accepts new publication metadata and GM spoiler warnings', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/lore');
    await fs.mkdir(contentRoot, { recursive: true });

    const markdown = `---
title: Copper Bit
collection: lore
type: economy
publication: preview
contentState: unfinished
audienceWarnings:
  - gmSpoilers
authors:
  - brad
---

Currency #money is discussed here.`;

    await fs.writeFile(path.join(contentRoot, 'Copper Bit.md'), markdown, 'utf8');

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/lore' }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('rejects missing publication metadata when no legacy status exists', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/lore');
    await fs.mkdir(contentRoot, { recursive: true });

    await fs.writeFile(
      path.join(contentRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
authors:
  - brad
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/lore' }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'src/content/lore/Copper Bit.md missing required publication metadata; add publication: preview|publish|archive (legacy status is accepted only during migration)',
    );
  });

  it('accepts contributor entries without type or authors requirements', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(contentRoot, { recursive: true });

    const markdown = `---
title: Brad
collection: contributors
status: publish
displayName: Brad
profileMode: featured
---

Contributor profile body.`;

    await fs.writeFile(path.join(contentRoot, 'brad.md'), markdown, 'utf8');

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/contributors', collection: 'contributors' }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('rejects author and attribution contributor ids without contributor profiles', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'brad.md'),
      `---
title: Brad
collection: contributors
status: publish
profileMode: featured
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - brad
  - missing-author
contributors:
  - id: missing-artist
    roles:
      - artist
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'src/content/lore/Copper Bit.md references unknown contributor id "missing-author" in authors; add a contributor profile at contributors/missing-author.md or fix the id',
    );
    expect(result.failures).toContain(
      'src/content/lore/Copper Bit.md references unknown contributor id "missing-artist" in contributors[].id; add a contributor profile at contributors/missing-artist.md or fix the id',
    );
  });

  it('rejects unsupported contributor attribution roles', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'known-artist.md'),
      `---
title: Known Artist
collection: contributors
status: publish
profileMode: standard
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - known-artist
contributors:
  - id: known-artist
    roles:
      - illustrator
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('src/content/lore/Copper Bit.md invalid contributors role value illustrator');
  });

  it('rejects markdown contributor links without contributor profiles', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'known-artist.md'),
      `---
title: Known Artist
collection: contributors
status: publish
profileMode: standard
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - known-artist
---

![Copper Bit coin](./copper-bit.jpg)

*Art by [Missing Artist](../contributors/missing-artist.md). Used with permission.*`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'src/content/lore/Copper Bit.md references unknown contributor id "missing-artist" in markdown link; add a contributor profile at contributors/missing-artist.md or fix the id',
    );
  });

  it('accepts markdown contributor links using contributors paths', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'known-artist.md'),
      `---
title: Known Artist
collection: contributors
status: publish
profileMode: standard
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - known-artist
---

![Copper Bit coin](./copper-bit.jpg)

*Art by [Known Artist](../contributors/known-artist.md). Used with permission.*`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('accepts author ids that match contributor profile aliases', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'Brad Arnst.md'),
      `---
title: Brad Arnst
collection: contributors
status: publish
profileMode: featured
aliases:
  - Brad
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - Brad
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('accepts author ids that match unique contributor display-name first tokens', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const loreRoot = path.join(tempRoot, 'src/content/lore');
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(loreRoot, { recursive: true });
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'Brad Arnst.md'),
      `---
title: Brad Arnst
collection: contributors
displayName: Brad Arnst
status: publish
profileMode: featured
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(loreRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: lore
type: economy
status: draft
authors:
  - Brad
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [
        { to: 'src/content/lore', collection: 'lore' },
        { to: 'src/content/contributors', collection: 'contributors' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('rejects contributor aliases claimed by multiple profiles', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contributorRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(contributorRoot, { recursive: true });

    await fs.writeFile(
      path.join(contributorRoot, 'Brad Arnst.md'),
      `---
title: Brad Arnst
collection: contributors
status: publish
profileMode: featured
aliases:
  - Brad
---

Contributor profile body.`,
      'utf8',
    );

    await fs.writeFile(
      path.join(contributorRoot, 'Brad Example.md'),
      `---
title: Brad Example
collection: contributors
status: publish
profileMode: featured
---

Contributor profile body.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/contributors', collection: 'contributors' }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'src/content/contributors/Brad Example.md contributor alias "Brad" is claimed by both "Brad Arnst" and "Brad Example"',
    );
  });

  it('rejects contributor entries without explicit collection or profileMode', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(contentRoot, { recursive: true });

    await fs.writeFile(
      path.join(contentRoot, 'brad.md'),
      `---
title: Brad
status: publish
---

Contributor profile body.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/contributors', collection: 'contributors' }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('src/content/contributors/brad.md missing required key collection');
    expect(result.failures).toContain('src/content/contributors/brad.md missing required key profileMode');
  });

  it('rejects unknown frontmatter collections', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/lore');
    await fs.mkdir(contentRoot, { recursive: true });

    await fs.writeFile(
      path.join(contentRoot, 'Copper Bit.md'),
      `---
title: Copper Bit
collection: unknownThings
type: economy
status: draft
authors:
  - brad
---

Currency text.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/lore', collection: 'lore' }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('src/content/lore/Copper Bit.md has unknown collection unknownThings');
  });

  it('rejects frontmatter collection mismatches with sync mapping or folder-derived collection', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-sync-validate-'));
    const contentRoot = path.join(tempRoot, 'src/content/contributors');
    await fs.mkdir(contentRoot, { recursive: true });

    await fs.writeFile(
      path.join(contentRoot, 'brad.md'),
      `---
title: Brad
collection: lore
status: publish
profileMode: featured
---

Contributor profile body.`,
      'utf8',
    );

    const result = await validateContentTree({
      repoRoot: tempRoot,
      mappings: [{ to: 'src/content/contributors', collection: 'contributors' }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'src/content/contributors/brad.md frontmatter collection "lore" does not match sync mapping/folder collection "contributors"',
    );
  });
});
