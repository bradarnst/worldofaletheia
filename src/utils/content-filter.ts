export type ContentEnvironment = 'production' | 'preview' | 'development';

interface ContentDataLike {
  status?: string;
  author?: string;
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
  const shared = ['publish', 'published', 'review', 'draft'];

  if (environment === 'development') {
    return [...shared, 'archive', 'archived'];
  }

  return shared;
}

/**
 * Determines whether content should be included in the current build environment.
 */
export function shouldIncludeContent<TData extends ContentDataLike>(
  content: ContentLike<TData>,
  environment: ContentEnvironment = 'production',
): boolean {
  const data = unwrapContentData(content);
  if (!data) {
    return false;
  }

  return getIncludedStatuses(environment).includes(data.status ?? '');
}

/**
 * Gets filtered content for a specific collection based on environment.
 */
export function getFilteredCollection<TData extends ContentDataLike, T extends ContentLike<TData>>(
  collection: T[],
  environment: ContentEnvironment = 'production',
): T[] {
  return collection.filter((item) => shouldIncludeContent(item, environment));
}

/**
 * Gets content entries for a specific author.
 */
export function getAuthorEntries<TData extends ContentDataLike, T extends ContentLike<TData>>(collection: T[], author: string): T[] {
  return collection.filter((item) => {
    const data = unwrapContentData(item);
    return data?.author === author;
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
