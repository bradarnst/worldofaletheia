/**
 * Campaign Service Interface
 * 
 * Defines the contract for campaign data access and operations.
 * 
 * @version 1.0.0
 */

import type {
  CampaignSummary,
  CampaignDetail,
  CampaignQueryParams,
  PermissionLevel,
} from '@contracts/campaigns';

/**
 * Repository interface for campaign data access
 * Abstracts the underlying storage mechanism
 */
export interface CampaignRepository {
  /**
   * Get all campaigns matching the query parameters
   */
  findAll(params?: CampaignQueryParams): Promise<CampaignSummary[]>;

  /**
   * Get a campaign by its unique slug
   */
  findBySlug(slug: string): Promise<CampaignDetail | null>;

  /**
   * Get a campaign by its ID
   */
  findById(id: string): Promise<CampaignDetail | null>;

  /**
   * Check if a campaign exists
   */
  exists(slug: string): Promise<boolean>;
}

/**
 * Service interface for campaign business logic
 * Orchestrates data access and applies domain rules
 */
export interface CampaignService {
  /**
   * List campaigns with optional filtering
   */
  listCampaigns(params?: CampaignQueryParams): Promise<CampaignSummary[]>;

  /**
   * Get detailed campaign information including sessions
   */
  getCampaign(slug: string): Promise<CampaignDetail | null>;

  /**
   * Get campaign statistics
   */
  getCampaignStats(slug: string): Promise<{
    totalSessions: number;
    totalDuration: number; // in minutes
    lastSessionDate?: Date;
    firstSessionDate?: Date;
  } | null>;
}

/**
 * Permission service for campaign access control
 */
export interface CampaignPermissionService {
  /**
   * Check if the current context can access the campaign
   */
  canAccess(campaignPermissions: PermissionLevel, userRole?: string): boolean;

  /**
   * Filter campaigns by accessible permissions
   */
  filterAccessible<T extends { permissions: PermissionLevel }>(
    items: T[],
    userRole?: string
  ): T[];
}
