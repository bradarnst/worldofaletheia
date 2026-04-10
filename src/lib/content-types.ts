/**
 * Shared content type definitions.
 * This is the single source of truth for type enums used by both:
 * - src/content.config.ts (Zod schemas)
 * - src/lib/r2-content-loader.mjs (VALID_TYPES for type sanitization)
 *
 * When adding new types, update this file first, then import in both places.
 */

// Lore types (shared between lore and campaignLore)
export const LORE_TYPES = [
  'cosmology',
  'religion',
  'economy',
  'history',
  'geography',
  'food_and_drink',
  'culture',
  'language',
  'warfare',
  'domestication',
  'magic',
  'technology',
  'structure',
  'other',
  'event',
] as const;

// Place types (shared between places and campaignPlaces)
export const PLACES_TYPES = [
  'location',
  'landmark',
  'dungeon',
  'settlement',
  'region',
  'polity',
  'adminDivision',
  'water',
  'biome',
] as const;

// Sentient types (shared between sentients and campaignSentients)
export const SENTIENTS_TYPES = [
  'race',
  'species',
  'culture',
  'organization',
  'deity',
] as const;

// Bestiary types (shared between bestiary and campaignBestiary)
export const BESTIARY_TYPES = [
  'monster',
  'animal',
  'beast',
  'spirit',
  'construct',
  'elemental',
] as const;

// Flora types (shared between flora and campaignFlora)
export const FLORA_TYPES = [
  'tree',
  'flower',
  'fungus',
  'herb',
  'fruit',
  'plant',
  'crop',
] as const;

// Faction types (shared between factions and campaignFactions)
export const FACTIONS_TYPES = [
  'political',
  'guild',
  'criminal',
  'government',
  'religion',
  'military',
  'police',
  'school',
  'order',
] as const;

// Systems types (shared between systems and campaignSystems)
export const SYSTEMS_TYPES = [
  'general',
  'gurps',
] as const;

// Meta types (shared between meta and campaignMeta)
export const META_TYPES = [
  'info',
  'technical',
  'content',
  'reference',
  'governance',
] as const;

// Session types
export const SESSIONS_TYPES = [
  'session',
  'encounter',
  'battle',
  'note',
] as const;

// Campaign character types
export const CAMPAIGN_CHARACTERS_TYPES = [
  'pc',
  'npc',
  'ally',
  'adversary',
  'patron',
  'creature',
  'group',
  'other',
] as const;

// Campaign scene types
export const CAMPAIGN_SCENES_TYPES = [
  'scene',
  'combat',
  'social',
  'travel',
  'downtime',
  'investigation',
  'flashback',
  'other',
] as const;

// Campaign adventure types
export const CAMPAIGN_ADVENTURES_TYPES = [
  'arc',
  'mission',
  'quest',
  'contract',
  'dungeon',
  'journey',
  'heist',
  'other',
] as const;

// Campaign hook types
export const CAMPAIGN_HOOKS_TYPES = [
  'rumor',
  'lead',
  'job',
  'threat',
  'mystery',
  'opportunity',
  'other',
] as const;

/**
 * All collection type enums mapped by collection name.
 * Used by r2-content-loader.mjs for VALID_TYPES.
 */
export const COLLECTION_TYPES = {
  lore: LORE_TYPES,
  places: PLACES_TYPES,
  sentients: SENTIENTS_TYPES,
  bestiary: BESTIARY_TYPES,
  flora: FLORA_TYPES,
  factions: FACTIONS_TYPES,
  systems: SYSTEMS_TYPES,
  meta: META_TYPES,
  sessions: SESSIONS_TYPES,
  campaignLore: LORE_TYPES,
  campaignPlaces: PLACES_TYPES,
  campaignSentients: SENTIENTS_TYPES,
  campaignBestiary: BESTIARY_TYPES,
  campaignFlora: FLORA_TYPES,
  campaignFactions: FACTIONS_TYPES,
  campaignSystems: SYSTEMS_TYPES,
  campaignMeta: META_TYPES,
  campaignCharacters: CAMPAIGN_CHARACTERS_TYPES,
  campaignScenes: CAMPAIGN_SCENES_TYPES,
  campaignAdventures: CAMPAIGN_ADVENTURES_TYPES,
  campaignHooks: CAMPAIGN_HOOKS_TYPES,
} as const;
