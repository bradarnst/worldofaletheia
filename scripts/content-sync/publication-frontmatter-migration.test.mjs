import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectVaultMarkdownFiles,
  createPublicationTemplateFields,
  migratePublicationFrontmatterFiles,
  migratePublicationFrontmatterText,
  planPublicationMetadataMigration,
} from './publication-frontmatter-migration.mjs';

describe('publication frontmatter migration helpers', () => {
  it('defaults new content templates to preview-only publication', () => {
    expect(createPublicationTemplateFields()).toEqual({
      publication: 'preview',
      contentState: 'unfinished',
      audienceWarnings: [],
    });
  });

  it('maps legacy archived status to archive and other legacy status values to publish', () => {
    expect(planPublicationMetadataMigration({ status: 'archived' }).publication).toBe('archive');
    expect(planPublicationMetadataMigration({ status: 'draft' }).publication).toBe('publish');
  });

  it('defaults files without legacy status to preview for safe vault migration', () => {
    expect(planPublicationMetadataMigration({}).publication).toBe('preview');
  });

  it('adds missing publication metadata without overwriting existing frontmatter', () => {
    const result = migratePublicationFrontmatterText(`---\ntitle: Copper Bit\nstatus: archived\ncontentState: mayChange\n---\n\nBody text.\n`);

    expect(result.changed).toBe(true);
    expect(result.addedKeys).toEqual(['publication', 'audienceWarnings']);
    expect(result.text).toBe(`---\ntitle: Copper Bit\nstatus: archived\ncontentState: mayChange\npublication: archive\naudienceWarnings: []\n---\n\nBody text.\n`);
  });

  it('does not change files that already have publication metadata', () => {
    const text = `---\ntitle: Copper Bit\npublication: publish\ncontentState: stable\naudienceWarnings: []\n---\n\nBody text.\n`;

    const result = migratePublicationFrontmatterText(text);

    expect(result.changed).toBe(false);
    expect(result.text).toBe(text);
    expect(result.reason).toBe('publication metadata already present');
  });

  it('reports malformed files without writing in dry-run mode', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-frontmatter-'));
    const filePath = path.join(tempRoot, 'Copper Bit.md');
    await fs.writeFile(filePath, `---\ntitle: Copper Bit\n`, 'utf8');

    const results = await migratePublicationFrontmatterFiles({ files: [filePath], write: false, labelRoot: tempRoot });

    expect(results).toEqual([
      {
        file: filePath,
        displayPath: 'Copper Bit.md',
        changed: false,
        addedKeys: [],
        reason: 'missing or malformed frontmatter',
      },
    ]);
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(`---\ntitle: Copper Bit\n`);
  });

  it('writes missing fields only when write mode is enabled', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-frontmatter-'));
    const filePath = path.join(tempRoot, 'Copper Bit.md');
    await fs.writeFile(filePath, `---\ntitle: Copper Bit\n---\n\nBody text.\n`, 'utf8');

    const dryRunResults = await migratePublicationFrontmatterFiles({ files: [filePath], write: false, labelRoot: tempRoot });
    expect(dryRunResults[0].changed).toBe(true);
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(`---\ntitle: Copper Bit\n---\n\nBody text.\n`);

    const writeResults = await migratePublicationFrontmatterFiles({ files: [filePath], write: true, labelRoot: tempRoot });
    expect(writeResults[0].addedKeys).toEqual(['publication', 'contentState', 'audienceWarnings']);
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(`---\ntitle: Copper Bit\npublication: preview\ncontentState: stable\naudienceWarnings: []\n---\n\nBody text.\n`);
  });

  it('collects unique markdown files from configured vault mappings', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-frontmatter-vault-'));
    const canonRoot = path.join(tempRoot, 'Canon');
    const assetsRoot = path.join(tempRoot, 'Assets');
    await fs.mkdir(canonRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });
    await fs.writeFile(path.join(canonRoot, 'Copper Bit.md'), '---\n---\n', 'utf8');
    await fs.writeFile(path.join(canonRoot, 'nested.md'), '---\n---\n', 'utf8');
    await fs.writeFile(path.join(assetsRoot, 'image.png'), '', 'utf8');

    const files = await collectVaultMarkdownFiles({
      vaultRoot: tempRoot,
      mappings: [
        { from: 'Canon' },
        { from: 'Canon' },
        { from: 'Assets' },
      ],
    });

    expect(files.map((file) => path.relative(tempRoot, file).split(path.sep).join('/'))).toEqual([
      'Canon/Copper Bit.md',
      'Canon/nested.md',
    ]);
  });
});
