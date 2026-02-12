/**
 * Astro Content Adapter
 * 
 * Implementation of the CampaignsDataAdapter using Astro's content collections.
 * This adapter reads from the local filesystem via Astro's glob loader.
 * 
 * @version 1.0.0
 */

import { getCollection, getEntry, render, type CollectionEntry } from 'astro:content';
import {
  type CampaignSummary,
  type CampaignDetail,
  type SessionSummary,
  type SessionDetail,
  type CampaignQueryParams,
  type SessionQueryParams,
  CampaignStatus,
  CampaignType,
  SessionType,
  PermissionLevel,
  type ContentMetadata,
  type RelatedContent,
  CAMPAIGNS_API_VERSION,
} from '@contracts/campaigns';
import type { CampaignsDataAdapter } from './campaign.adapter';

async function getCampaignEntryBySlug(slug: string) {
  const direct = await getEntry('campaigns', slug);
  if (direct) {
    return direct;
  }

  // Compatibility fallback for folder/index style ids.
  return getEntry('campaigns', `${slug}/index`);
}

/**
 * Environment-aware permission checker
 */
function checkEnvironmentPermissions(
  permissions: PermissionLevel,
  secret: boolean,
  environment: string = 'production'
): boolean {
  // Secret content only in development
  if (secret && environment !== 'development') {
    return false;
  }

  // In development, show all
  if (environment === 'development') {
    return true;
  }

  // In preview, show public and player content
  if (environment === 'preview') {
    return permissions !== PermissionLevel.GM && permissions !== PermissionLevel.AUTHOR;
  }

  // Production: public only
  return permissions === PermissionLevel.PUBLIC;
}

/**
 * Map Astro campaign entry to CampaignSummary DTO
 */
function mapToCampaignSummary(
  entry: CollectionEntry<'campaigns'>,
  sessionCount: number = 0
): CampaignSummary {
  const data = entry.data;
  const campaignSlug = entry.id.replace(/\/index$/, '');
  
  return {
    id: campaignSlug,
    slug: campaignSlug,
    title: data.title,
    status: data.status as CampaignStatus,
    type: data.type as CampaignType,
    excerpt: data.excerpt,
    startDate: data.start,
    endDate: data.end,
    permissions: data.permissions as PermissionLevel,
    authors: [data.author],
    sessionCount,
    tags: data.tags,
  };
}

/**
 * Map Astro campaign entry to CampaignDetail DTO
 */
function mapToCampaignDetail(
  entry: CollectionEntry<'campaigns'>,
  sessions: SessionSummary[] = [],
  body: string = ''
): CampaignDetail {
  const data = entry.data;
  const now = new Date();
  const campaignSlug = entry.id.replace(/\/index$/, '');
  
  return {
    ...mapToCampaignSummary(entry, sessions.length),
    description: data.excerpt || '',
    content: body,
    sessions,
    relatedContent: [], // Populate based on tags/campaign
    metadata: {
      createdAt: data.created,
      updatedAt: now,
      sourcePath: `src/content/campaigns/${campaignSlug}/index.md`,
      lastIngestedAt: now,
      version: CAMPAIGNS_API_VERSION,
    },
  };
}

/**
 * Map Astro session entry to SessionSummary DTO
 */
function mapToSessionSummary(entry: CollectionEntry<'sessions'>): SessionSummary {
  const data = entry.data;
  // Extract campaign slug from path: campaign-slug/sessions/session-slug
  const pathParts = entry.id.split('/');
  const campaignSlug = pathParts[0];
  const sessionSlug = pathParts[pathParts.length - 1];
  
  return {
    id: entry.id,
    slug: sessionSlug,
    campaignSlug,
    campaignId: campaignSlug,
    title: data.title,
    date: data.date,
    duration: data.duration,
    type: data.type as SessionType,
    permissions: data.permissions as PermissionLevel,
    excerpt: data.excerpt,
    tags: data.tags,
    secret: data.secret,
  };
}

/**
 * Map Astro session entry to SessionDetail DTO
 */
function mapToSessionDetail(
  entry: CollectionEntry<'sessions'>,
  body: string = ''
): SessionDetail {
  const summary = mapToSessionSummary(entry);
  const data = entry.data;
  const now = new Date();
  
  return {
    ...summary,
    content: body,
    relatedContent: [],
    metadata: {
      createdAt: data.created,
      updatedAt: now,
      sourcePath: `src/content/campaigns/${entry.id}.md`,
      lastIngestedAt: now,
      version: CAMPAIGNS_API_VERSION,
      author: data.author,
    },
  };
}

/**
 * Astro Content Adapter implementation
 */
export class AstroContentAdapter implements CampaignsDataAdapter {
  readonly version = CAMPAIGNS_API_VERSION;
  private _isReady = false;

  async initialize(): Promise<void> {
    // Astro collections are automatically initialized
    this._isReady = true;
  }

  isReady(): boolean {
    return this._isReady;
  }

  // Campaign operations

  async getCampaigns(params?: CampaignQueryParams): Promise<CampaignSummary[]> {
    const campaigns = await getCollection('campaigns');
    
    // Get session counts
    const sessions = await getCollection('sessions');
    const sessionCounts = new Map<string, number>();
    
    for (const session of sessions) {
      const campaignSlug = session.data.campaign;
      if (campaignSlug) {
        sessionCounts.set(campaignSlug, (sessionCounts.get(campaignSlug) || 0) + 1);
      }
    }
    
    let results = campaigns.map(c => 
      mapToCampaignSummary(c, sessionCounts.get(c.id.replace(/\/index$/, '')) || 0)
    );

    // Apply filters
    if (params?.status) {
      results = results.filter(c => c.status === params.status);
    }
    if (params?.type) {
      results = results.filter(c => c.type === params.type);
    }
    if (params?.author) {
      results = results.filter(c => c.authors.includes(params.author!));
    }

    return results;
  }

  async getCampaignBySlug(slug: string): Promise<CampaignDetail | null> {
    const entry = await getCampaignEntryBySlug(slug);
    if (!entry) {
      return null;
    }

    // Get sessions for this campaign
    const sessions = await this.getSessionsByCampaign(slug);
    
    // Render content
    // Note: In Astro SSR, we can't easily get the raw markdown body,
    // so we use an empty string here - pages will render the Content component directly
    
    return mapToCampaignDetail(entry, sessions, '');
  }

  async getCampaignById(id: string): Promise<CampaignDetail | null> {
    return this.getCampaignBySlug(id);
  }

  async campaignExists(slug: string): Promise<boolean> {
    const entry = await getCampaignEntryBySlug(slug);
    return entry !== undefined;
  }

  // Session operations

  async getSessions(params?: SessionQueryParams): Promise<SessionSummary[]> {
    const sessions = await getCollection('sessions');
    let results = sessions.map(mapToSessionSummary);

    // Apply filters
    if (params?.campaignSlug) {
      results = results.filter(s => s.campaignSlug === params.campaignSlug);
    }
    if (params?.campaignId) {
      results = results.filter(s => s.campaignId === params.campaignId);
    }
    if (params?.type) {
      results = results.filter(s => s.type === params.type);
    }

    return results;
  }

  async getSessionsByCampaign(campaignSlug: string): Promise<SessionSummary[]> {
    return this.getSessions({ campaignSlug });
  }

  async getSessionBySlug(
    campaignSlug: string,
    sessionSlug: string
  ): Promise<SessionDetail | null> {
    // Construct the full path: campaign-slug/sessions/session-slug
    const fullPath = `${campaignSlug}/sessions/${sessionSlug}`;
    const entry = await getEntry('sessions', fullPath);
    
    if (!entry) {
      return null;
    }

    return mapToSessionDetail(entry, '');
  }

  async getSessionById(id: string): Promise<SessionDetail | null> {
    const entry = await getEntry('sessions', id);
    if (!entry) {
      return null;
    }

    return mapToSessionDetail(entry, '');
  }

  async sessionExists(campaignSlug: string, sessionSlug: string): Promise<boolean> {
    const fullPath = `${campaignSlug}/sessions/${sessionSlug}`;
    const entry = await getEntry('sessions', fullPath);
    return entry !== undefined;
  }
}

// Singleton instance
export const astroContentAdapter = new AstroContentAdapter();
