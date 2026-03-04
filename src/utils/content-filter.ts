/**
 * Determines whether content should be included in the current build environment
 * 
 * @param content - The content object with frontmatter
 * @param environment - The current build environment ('production', 'preview', 'development')
 * @returns boolean - Whether the content should be included
 */
export function shouldIncludeContent(content: any, environment: string = 'production'): boolean {
  const data = content?.data ?? content;
  if (!data) {
    return false;
  }

  // Deprecated policy: secret is ignored for access control.
  // Visibility is campaign-domain auth metadata and is intentionally not enforced here.

  // Always include published content in all environments.
  if (data.status === 'publish' || data.status === 'published') {
    return true;
  }
  
  if (data.status === 'review') {
    return true; // Include review content in all environments for testing purposes
  }
  
  // TEMPORARY POLICY: drafts are currently included in all environments and visually flagged in UI.
  // Decision pending dedicated draft-preview workflow.
  if (data.status === 'draft') {
    return true; // Include drafts in all environments for testing purposes
    // return environment !== 'production';
  }

  // Include archived content only in development environment
  if (data.status === 'archive' || data.status === 'archived') {
    return environment === 'development';
  }
  
  return false;
}

/**
 * Gets filtered content for a specific collection based on environment
 * 
 * @param collection - The Astro content collection
 * @param environment - The current build environment
 * @returns Filtered content array
 */
export function getFilteredCollection(collection: any[], environment: string = 'production'): any[] {
  return collection.filter((item) => shouldIncludeContent(item, environment));
}

/**
 * Gets content entries for a specific author
 * 
 * @param collection - The Astro content collection
 * @param author - The author name to filter by
 * @returns Filtered content array for the author
 */
export function getAuthorEntries(collection: any[], author: string): any[] {
  return collection.filter((item) => {
    const data = item?.data ?? item;
    return data.author === author;
  });
}

/**
 * Gets content entries for a specific campaign
 * 
 * @param collection - The Astro content collection
 * @param campaign - The campaign name to filter by
 * @returns Filtered content array for the campaign
 */
export function getCampaignEntries(collection: any[], campaign: string): any[] {
  return collection.filter((item) => {
    const data = item?.data ?? item;
    return data.campaign === campaign;
  });
}
