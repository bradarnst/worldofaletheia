import { describe, expect, it } from 'vitest';
import { shouldIncludeContent } from './content-filter';

describe('shouldIncludeContent', () => {
  it('includes published content in production through publication metadata', () => {
    expect(shouldIncludeContent({ publication: 'publish', secret: true }, 'production')).toBe(true);
  });

  it('derives production publication from legacy non-archive status values', () => {
    expect(shouldIncludeContent({ status: 'publish', secret: true }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', secret: true }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'draft', secret: true }, 'production')).toBe(true);
  });

  it('excludes content with neither publication nor legacy status', () => {
    expect(shouldIncludeContent({}, 'production')).toBe(false);
  });

  it('excludes preview content from production and includes it in preview/development', () => {
    expect(shouldIncludeContent({ publication: 'preview' }, 'production')).toBe(false);
    expect(shouldIncludeContent({ publication: 'preview' }, 'preview')).toBe(true);
    expect(shouldIncludeContent({ publication: 'preview' }, 'development')).toBe(true);
  });

  it('keeps archived content out of normal listing environments', () => {
    expect(shouldIncludeContent({ publication: 'archive', secret: false }, 'development')).toBe(false);
    expect(shouldIncludeContent({ publication: 'archive', secret: false }, 'production')).toBe(false);
    expect(shouldIncludeContent({ status: 'archive', secret: false }, 'production')).toBe(false);
    expect(shouldIncludeContent({ status: 'archived', secret: false }, 'development')).toBe(false);
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
    expect(shouldIncludeContent({ status: 'published', gmResource: true }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', gm: true, 'gm-info': 'notes' }, 'production')).toBe(true);
    expect(shouldIncludeContent({ status: 'published', 'gm-info': 'true' }, 'production')).toBe(true);
  });

  it('lets publication override legacy status during migration', () => {
    expect(shouldIncludeContent({ publication: 'preview', status: 'publish' }, 'production')).toBe(false);
    expect(shouldIncludeContent({ publication: 'publish', status: 'archive' }, 'production')).toBe(true);
  });

  it('returns false for missing content data', () => {
    expect(shouldIncludeContent(null, 'production')).toBe(false);
  });
});
