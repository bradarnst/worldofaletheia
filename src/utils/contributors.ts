export interface ContributorCredit {
  id: string;
  roles?: string[];
}

export interface ContributorProfileLike {
  title?: string;
  displayName?: string;
}

export interface AuthoredContentLike {
  authors?: string[];
  author?: string;
  contributors?: ContributorCredit[];
}

function normalizeContributorIds(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

export function formatAuthors(authors: string[] | undefined, fallbackAuthor?: string): string | undefined {
  const normalizedAuthors = normalizeContributorIds(authors);
  if (normalizedAuthors.length > 0) {
    return normalizedAuthors.join(', ');
  }

  const normalizedFallback = fallbackAuthor?.trim();
  return normalizedFallback ? normalizedFallback : undefined;
}

export function getContributorDisplayName(profile: ContributorProfileLike, fallbackId?: string): string {
  return profile.displayName?.trim() || profile.title?.trim() || fallbackId || 'Unknown contributor';
}

export function contentIncludesContributor(content: AuthoredContentLike, contributorId: string): boolean {
  const normalizedContributorId = contributorId.trim();
  if (!normalizedContributorId) {
    return false;
  }

  if (normalizeContributorIds(content.authors).includes(normalizedContributorId)) {
    return true;
  }

  return (content.contributors ?? []).some((credit) => credit.id === normalizedContributorId);
}
