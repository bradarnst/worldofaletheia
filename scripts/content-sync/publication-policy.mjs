export const PUBLICATION_VALUES = ['preview', 'publish', 'archive'];
export const CONTENT_STATE_VALUES = ['stable', 'mayChange', 'unfinished'];
export const AUDIENCE_WARNING_VALUES = ['gmSpoilers'];

export function normalizeScalar(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return trimmed ? trimmed : null;
}

export function publicationFromLegacyStatus(status) {
  const normalized = normalizeScalar(status)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized === 'archive' || normalized === 'archived' ? 'archive' : 'publish';
}

export function resolvePublicationFromFrontmatter(frontmatterRecord = {}) {
  const publication = normalizeScalar(frontmatterRecord.publication);
  if (PUBLICATION_VALUES.includes(publication)) {
    return publication;
  }

  if (publication) {
    return publication;
  }

  return publicationFromLegacyStatus(frontmatterRecord.status);
}

export function resolvePublicationSyncLane(env = process.env) {
  const syncMode = normalizeScalar(env.CONTENT_INDEX_SYNC_MODE)?.toLowerCase();
  const syncEnv = normalizeScalar(env.CONTENT_INDEX_SYNC_ENV)?.toLowerCase();

  if (syncMode === 'remote' && !syncEnv) {
    return 'production';
  }

  if (syncEnv === 'production' || syncEnv === 'prod') {
    return 'production';
  }

  return 'staging';
}

export function getIncludedPublicationsForSyncLane(lane) {
  return lane === 'production' ? ['publish'] : ['preview', 'publish'];
}

export function shouldIncludePublicationForSync(frontmatterRecord, env = process.env) {
  const lane = resolvePublicationSyncLane(env);
  return getIncludedPublicationsForSyncLane(lane).includes(resolvePublicationFromFrontmatter(frontmatterRecord));
}
