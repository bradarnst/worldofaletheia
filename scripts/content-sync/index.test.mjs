import { describe, expect, it } from 'vitest';
import { parseArgs } from './index.mjs';

describe('content-sync CLI args', () => {
  it('parses dry-run and validate-only flags', () => {
    expect(parseArgs(['node', 'index.mjs', '--dry-run'])).toEqual({
      dryRun: true,
      validateOnly: false,
    });

    expect(parseArgs(['node', 'index.mjs', '--validate-only'])).toEqual({
      dryRun: false,
      validateOnly: true,
    });
  });

  it('ignores removed git-only flag in parser output', () => {
    expect(parseArgs(['node', 'index.mjs', '--git-only'])).toEqual({
      dryRun: false,
      validateOnly: false,
    });
  });
});
