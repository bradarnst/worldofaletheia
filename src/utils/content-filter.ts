export type ContentEnvironment = 'production' | 'preview' | 'development';
export type Publication = 'preview' | 'publish' | 'archive';

interface ContentDataLike {
  publication?: string;
  contentState?: string;
  audienceWarnings?: string[];
  status?: string;
  authors?: string[];
  author?: string;
  contributors?: Array<{ id: string; roles?: string[] }>;
  campaign?: string;
}

type ContentLike<TData extends ContentDataLike = ContentDataLike> = TData | { data?: TData | null } | null | undefined;

function isContentDataLike(candidate: unknown): candidate is ContentDataLike {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

function unwrapContentData<TData extends ContentDataLike>(content: ContentLike<TData>): TData | null {
  if (!isContentDataLike(content)) {
    return null;
  }

  if ('data' in content && isContentDataLike(content.data)) {
    return content.data as TData;
  }

  return content as TData;
}

export function getIncludedStatuses(environment: ContentEnvironment = 'production'): string[] {
  // Legacy status compatibility only. New code should prefer publication metadata.
  const shared = ['publish', 'published', 'review', 'draft', 'planning', 'active', 'completed', 'on-hold', 'cancelled'];

  return shared;
}

export function getDefaultContentEnvironment(): ContentEnvironment {
  if (import.meta.env.DEV) {
    return 'development';
  }

  if (import.meta.env.CONTENT_LOADER_D1_ENV === 'staging') {
    return 'preview';
  }

  return 'production';
}

export function getIncludedPublications(environment: ContentEnvironment = 'production'): Publication[] {
  if (environment === 'preview' || environment === 'development') {
    return ['preview', 'publish'];
  }

  return ['publish'];
}

export function publicationFromLegacyStatus(status: string | undefined | null): Publication | null {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized === 'archive' || normalized === 'archived' ? 'archive' : 'publish';
}

export function resolvePublication(data: ContentDataLike): Publication | null {
  const publication = data.publication?.trim();
  if (publication === 'preview' || publication === 'publish' || publication === 'archive') {
    return publication;
  }

  return publicationFromLegacyStatus(data.status);
}

/**
 * Determines whether content should be included in the current build environment.
 */
export function shouldIncludeContent<TData extends ContentDataLike>(
  content: ContentLike<TData>,
  environment: ContentEnvironment = getDefaultContentEnvironment(),
): boolean {
  const data = unwrapContentData(content);
  if (!data) {
    return false;
  }

  return getIncludedPublications(environment).includes(resolvePublication(data));
}

/**
 * Gets filtered content for a specific collection based on environment.
 */
export function getFilteredCollection<TData extends ContentDataLike, T extends ContentLike<TData>>(
  collection: T[],
  environment: ContentEnvironment = getDefaultContentEnvironment(),
): T[] {
  return collection.filter((item) => shouldIncludeContent(item, environment));
}

/**
 * Gets content entries for a specific author/contributor id.
 */
export function getAuthorEntries<TData extends ContentDataLike, T extends ContentLike<TData>>(collection: T[], author: string): T[] {
  return collection.filter((item) => {
    const data = unwrapContentData(item);
    return (data?.authors ?? []).includes(author) || (data?.contributors ?? []).some((credit) => credit.id === author);
  });
}

/**
 * Gets content entries for a specific campaign.
 */
export function getCampaignEntries<TData extends ContentDataLike, T extends ContentLike<TData>>(collection: T[], campaign: string): T[] {
  return collection.filter((item) => {
    const data = unwrapContentData(item);
    return data?.campaign === campaign;
  });
}
