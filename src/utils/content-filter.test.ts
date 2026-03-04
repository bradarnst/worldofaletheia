import { describe, expect, it } from 'vitest';
import { shouldIncludeContent } from './content-filter';

describe('shouldIncludeContent', () => {
  it('ignores deprecated secret when status is publish/published', () => {
    expect(shouldIncludeContent({ status: 'publish', secret: true }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', secret: true }, 'production')).toBe(true);
  });

  it('ignores deprecated secret when status is draft', () => {
    expect(shouldIncludeContent({ status: 'draft', secret: true }, 'production')).toBe(true);
  });

  it('keeps archived content development-only', () => {
    expect(shouldIncludeContent({ status: 'archive', secret: false }, 'development')).toBe(true);
    expect(shouldIncludeContent({ status: 'archive', secret: false }, 'production')).toBe(false);
    expect(shouldIncludeContent({ status: 'archived', secret: false }, 'development')).toBe(true);
    expect(shouldIncludeContent({ status: 'archived', secret: false }, 'production')).toBe(false);
  });

  it('supports data-wrapped entries from Astro collections', () => {
    const wrapped = { data: { status: 'published', secret: true } };
    expect(shouldIncludeContent(wrapped, 'production')).toBe(true);
  });

  it('does not treat GM-style labels as authorization gates', () => {
    expect(shouldIncludeContent({ status: 'published', permissions: 'gm' }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', tags: ['gm-data'] }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', tags: ['gm-info'] }, 'production')).toBe(true);
  });

  it('returns false for missing content data', () => {
    expect(shouldIncludeContent(null as any, 'production')).toBe(false);
  });
});
