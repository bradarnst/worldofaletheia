/**
 * Session Service Interface
 * 
 * Defines the contract for session data access and operations.
 * 
 * @version 1.0.0
 */

import type {
  SessionSummary,
  SessionDetail,
  SessionQueryParams,
} from '@contracts/campaigns';

/**
 * Repository interface for session data access
 * Abstracts the underlying storage mechanism
 */
export interface SessionRepository {
  /**
   * Get all sessions matching the query parameters
   */
  findAll(params?: SessionQueryParams): Promise<SessionSummary[]>;

  /**
   * Get all sessions for a specific campaign
   */
  findByCampaign(campaignSlug: string): Promise<SessionSummary[]>;

  /**
   * Get a session by its campaign slug and session slug
   */
  findBySlug(campaignSlug: string, sessionSlug: string): Promise<SessionDetail | null>;

  /**
   * Get a session by its ID
   */
  findById(id: string): Promise<SessionDetail | null>;

  /**
   * Check if a session exists
   */
  exists(campaignSlug: string, sessionSlug: string): Promise<boolean>;
}

/**
 * Service interface for session business logic
 * Orchestrates data access and applies domain rules
 */
export interface SessionService {
  /**
   * List sessions with optional filtering
   */
  listSessions(params?: SessionQueryParams): Promise<SessionSummary[]>;

  /**
   * List sessions for a specific campaign
   */
  listCampaignSessions(campaignSlug: string): Promise<SessionSummary[]>;

  /**
   * Get detailed session information
   */
  getSession(campaignSlug: string, sessionSlug: string): Promise<SessionDetail | null>;

  /**
   * Get the next session for a campaign
   */
  getNextSession(campaignSlug: string): Promise<SessionSummary | null>;

  /**
   * Get the previous session for a campaign
   */
  getPreviousSession(campaignSlug: string, currentSessionSlug: string): Promise<SessionSummary | null>;
}
