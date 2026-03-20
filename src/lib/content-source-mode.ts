export type ContentSourceMode = 'local' | 'cloud';
type EnvLike = Record<string, string | undefined>;

export interface ResolvedContentSource {
  mode: ContentSourceMode;
  overrides: Map<string, ContentSourceMode>;
}

function normalizeMode(value: string | undefined): ContentSourceMode {
  return value === 'cloud' ? 'cloud' : 'local';
}

function parseOverrides(rawValue: string | undefined): Map<string, ContentSourceMode> {
  const overrides = new Map<string, ContentSourceMode>();
  if (!rawValue) {
    return overrides;
  }

  for (const segment of rawValue.split(',')) {
    const [collectionRaw, modeRaw] = segment.split(':');
    const collection = collectionRaw?.trim();
    const mode = modeRaw?.trim();
    if (!collection || !mode) {
      continue;
    }
    overrides.set(collection, normalizeMode(mode));
  }

  return overrides;
}

function getDefaultEnv(): EnvLike {
  return import.meta.env as EnvLike;
}

export function resolveContentSource(env: EnvLike = getDefaultEnv()): ResolvedContentSource {
  return {
    mode: normalizeMode(env.CONTENT_SOURCE_MODE),
    overrides: parseOverrides(env.CONTENT_SOURCE_OVERRIDES),
  };
}

export function resolveCollectionSource(
  collection: string,
  env: EnvLike = getDefaultEnv(),
): ContentSourceMode {
  const resolved = resolveContentSource(env);
  return resolved.overrides.get(collection) ?? resolved.mode;
}
