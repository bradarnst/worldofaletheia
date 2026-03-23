export type ContentEnvironment = 'production' | 'preview' | 'development';

interface ContentDataLike {
  status?: string;
  author?: string;
  campaign?: string;
}

type ContentLike = ContentDataLike | { data?: ContentDataLike } | null | undefined;

function unwrapContentData(content: ContentLike): ContentDataLike | null {
  if (!content || typeof content !== 'object') {
    return null;
  }

  if ('data' in content && content.data && typeof content.data === 'object') {
    return content.data;
  }

  return content;
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
export function shouldIncludeContent(content: ContentLike, environment: ContentEnvironment = 'production'): boolean {
  const data = unwrapContentData(content);
  if (!data) {
    return false;
  }

  return getIncludedStatuses(environment).includes(data.status ?? '');
}

/**
 * Gets filtered content for a specific collection based on environment.
 */
export function getFilteredCollection<T extends ContentLike>(
  collection: T[],
  environment: ContentEnvironment = 'production',
): T[] {
  return collection.filter((item) => shouldIncludeContent(item, environment));
}

/**
 * Gets content entries for a specific author.
 */
export function getAuthorEntries<T extends ContentLike>(collection: T[], author: string): T[] {
  return collection.filter((item) => {
    const data = unwrapContentData(item);
    return data?.author === author;
  });
}

/**
 * Gets content entries for a specific campaign.
 */
export function getCampaignEntries<T extends ContentLike>(collection: T[], campaign: string): T[] {
  return collection.filter((item) => {
    const data = unwrapContentData(item);
    return data?.campaign === campaign;
  });
}
