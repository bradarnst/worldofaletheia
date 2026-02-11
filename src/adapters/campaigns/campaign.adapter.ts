/**
 * Campaign Adapter Interface
 * 
 * Defines the contract for campaign data source adapters.
 * This abstraction allows swapping between different data sources
 * (Astro content collections, REST API, database, etc.)
 * 
 * @version 1.0.0
 */

import type {
  CampaignSummary,
  CampaignDetail,
  SessionSummary,
  SessionDetail,
  CampaignQueryParams,
  SessionQueryParams,
} from '@contracts/campaigns';

/**
 * Adapter interface for campaign data sources
 */
export interface CampaignAdapter {
  /**
   * Get all campaigns matching the query parameters
   */
  getCampaigns(params?: CampaignQueryParams): Promise<CampaignSummary[]>;

  /**
   * Get a campaign by slug
   */
  getCampaignBySlug(slug: string): Promise<CampaignDetail | null>;

  /**
   * Get a campaign by ID
   */
  getCampaignById(id: string): Promise<CampaignDetail | null>;

  /**
   * Check if a campaign exists
   */
  campaignExists(slug: string): Promise<boolean>;
}

/**
 * Adapter interface for session data sources
 */
export interface SessionAdapter {
  /**
   * Get all sessions matching the query parameters
   */
  getSessions(params?: SessionQueryParams): Promise<SessionSummary[]>;

  /**
   * Get sessions for a specific campaign
   */
  getSessionsByCampaign(campaignSlug: string): Promise<SessionSummary[]>;

  /**
   * Get a session by campaign and session slug
   */
  getSessionBySlug(campaignSlug: string, sessionSlug: string): Promise<SessionDetail | null>;

  /**
   * Get a session by ID
   */
  getSessionById(id: string): Promise<SessionDetail | null>;

  /**
   * Check if a session exists
   */
  sessionExists(campaignSlug: string, sessionSlug: string): Promise<boolean>;
}

/**
 * Combined adapter interface for campaigns domain
 */
export interface CampaignsDataAdapter extends CampaignAdapter, SessionAdapter {
  /**
   * Adapter version for compatibility checking
   */
  readonly version: string;

  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Check if adapter is ready
   */
  isReady(): boolean;
}
