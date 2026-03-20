import { describe, expect, it } from 'vitest';
import { resolveCollectionSource, resolveContentSource } from './content-source-mode';

type EnvLike = Record<string, string | undefined>;

describe('content source mode resolution', () => {
  it('defaults to local mode', () => {
    expect(resolveContentSource({} as EnvLike)).toEqual({
      mode: 'local',
      overrides: new Map(),
    });
  });

  it('applies emergency collection overrides on top of global mode', () => {
    const env = {
      CONTENT_SOURCE_MODE: 'cloud',
      CONTENT_SOURCE_OVERRIDES: 'meta:local,campaigns:cloud',
    } as EnvLike;

    expect(resolveCollectionSource('meta', env)).toBe('local');
    expect(resolveCollectionSource('campaigns', env)).toBe('cloud');
    expect(resolveCollectionSource('lore', env)).toBe('cloud');
  });
});
