import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  removeLegacyFrontmatterFiles,
  removeLegacyFrontmatterText,
} from './legacy-frontmatter-removal.mjs';

describe('legacy frontmatter removal', () => {
  it('removes top-level status and secret keys from frontmatter', () => {
    const result = removeLegacyFrontmatterText(`---
title: Copper Bit
status: publish
publication: publish
secret: false
contentState: stable
---

Body text.
`);

    expect(result.changed).toBe(true);
    expect(result.removedKeys).toEqual(['status', 'secret']);
    expect(result.text).toBe(`---
title: Copper Bit
publication: publish
contentState: stable
---

Body text.
`);
  });

  it('does not remove nested status or secret-like body text', () => {
    const result = removeLegacyFrontmatterText(`---
title: Copper Bit
contributors:
  - id: brad
    status: active
    secret: nope
publication: publish
---

status: this is body text
secret: this is also body text
`);

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('no legacy frontmatter keys present');
  });

  it('reports malformed frontmatter without changing text', () => {
    const text = `---
title: Copper Bit
status: publish
`;
    const result = removeLegacyFrontmatterText(text);

    expect(result.changed).toBe(false);
    expect(result.text).toBe(text);
    expect(result.reason).toBe('missing or malformed frontmatter');
  });

  it('writes only when write mode is enabled', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-frontmatter-'));
    const filePath = path.join(tempRoot, 'Copper Bit.md');
    await fs.writeFile(filePath, `---
title: Copper Bit
status: publish
publication: publish
secret: true
---

Body text.
`, 'utf8');

    const dryRunResults = await removeLegacyFrontmatterFiles({ files: [filePath], write: false, labelRoot: tempRoot });
    expect(dryRunResults).toEqual([
      {
        file: filePath,
        displayPath: 'Copper Bit.md',
        changed: true,
        removedKeys: ['status', 'secret'],
        reason: null,
      },
    ]);
    await expect(fs.readFile(filePath, 'utf8')).resolves.toContain('status: publish');

    const writeResults = await removeLegacyFrontmatterFiles({ files: [filePath], write: true, labelRoot: tempRoot });
    expect(writeResults[0].removedKeys).toEqual(['status', 'secret']);
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(`---
title: Copper Bit
publication: publish
---

Body text.
`);
  });

  it('preserves CRLF newlines', () => {
    const text = ['---', 'title: Copper Bit', 'status: publish', 'publication: publish', '---', '', 'Body text.', ''].join('\r\n');
    const expected = ['---', 'title: Copper Bit', 'publication: publish', '---', '', 'Body text.', ''].join('\r\n');

    const result = removeLegacyFrontmatterText(text);

    expect(result.text).toBe(expected);
  });
});
