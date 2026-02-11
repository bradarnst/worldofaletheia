/**
 * Campaigns Domain Contracts
 * 
 * DTOs and type definitions for the Campaigns domain.
 * These types are framework-agnostic and serializable.
 * 
 * @version 1.0.0
 */

// Enums
export enum CampaignStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ON_HOLD = 'on-hold',
  CANCELLED = 'cancelled',
}

export enum CampaignType {
  CAMPAIGN = 'campaign',
  ADVENTURE = 'adventure',
  QUEST = 'quest',
  STORY = 'story',
}

export enum SessionType {
  SESSION = 'session',
  ENCOUNTER = 'encounter',
  BATTLE = 'battle',
  ROLEPLAY = 'roleplay',
}

export enum PermissionLevel {
  PUBLIC = 'public',
  PLAYER = 'player',
  GM = 'gm',
  AUTHOR = 'author',
}

// Base metadata interface
export interface ContentMetadata {
  createdAt: Date;
  updatedAt: Date;
  sourcePath: string;
  lastIngestedAt: Date;
  version: string;
}

// Related content reference
export interface RelatedContent {
  id: string;
  title: string;
  type: string;
  url: string;
}

// Campaign DTOs
export interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  type: CampaignType;
  excerpt?: string;
  startDate?: Date;
  endDate?: Date;
  permissions: PermissionLevel;
  authors: string[];
  sessionCount: number;
  tags: string[];
}

export interface CampaignDetail extends CampaignSummary {
  description: string;
  content: string; // Markdown body
  sessions: SessionSummary[];
  relatedContent: RelatedContent[];
  metadata: ContentMetadata;
}

// Session DTOs
export interface SessionSummary {
  id: string;
  slug: string;
  campaignSlug: string;
  campaignId: string;
  title: string;
  date?: Date;
  duration?: number; // in minutes
  type: SessionType;
  permissions: PermissionLevel;
  excerpt?: string;
  tags: string[];
  secret: boolean;
}

export interface SessionDetail extends SessionSummary {
  content: string; // Markdown body
  relatedContent: RelatedContent[];
  metadata: ContentMetadata & {
    author: string;
  };
}

// API Contract version marker
export const CAMPAIGNS_API_VERSION = 'v1';

// Query parameters
export interface CampaignQueryParams {
  status?: CampaignStatus;
  type?: CampaignType;
  author?: string;
  permissions?: PermissionLevel;
  includeSessions?: boolean;
}

export interface SessionQueryParams {
  campaignSlug?: string;
  campaignId?: string;
  type?: SessionType;
  dateFrom?: Date;
  dateTo?: Date;
  permissions?: PermissionLevel;
}
