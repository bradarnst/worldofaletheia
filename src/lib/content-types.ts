import { CONTRIBUTOR_ROLE_TYPES as CONTRIBUTOR_ROLE_TYPE_VALUES } from '~/lib/contributor-role-types.mjs';

/**
 * Shared content type definitions.
 * This is the single source of truth for type enums used by both:
 * - src/content.config.ts (Zod schemas)
 * - src/lib/r2-content-loader.mjs (VALID_TYPES for type sanitization)
 *
 * When adding new types, update this file first, then import in both places.
 */

// Lore types
export const LORE_TYPES = [
  'cosmology',
  'religion',
  'economy',
  'history',
  'geography',
  'food-drink',
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

// Place types
export const PLACES_TYPES = [
  'location',
  'landmark',
  'dungeon',
  'settlement',
  'region',
  'country',
  'territory',
  'water',
  'biome',
  'dimension',
  'world'
] as const;

// Sentient types
export const SENTIENTS_TYPES = [
  'race',
  'species',
  'culture',
  'organization',
  'deity',
] as const;

// Bestiary types
export const BESTIARY_TYPES = [
  'monster',
  'animal',
  'undead',
  'spirit',
  'construct',
  'elemental',
] as const;

// Flora types
export const FLORA_TYPES = [
  'tree',
  'flower',
  'fungus',
  'herb',
  'fruit',
  'plant',
  'crop',
] as const;

// Faction types
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

// Systems types
export const SYSTEMS_TYPES = [
  'general',
  'gurps',
] as const;

// Meta types
export const META_TYPES = [
  'info',
  'technical',
  'content',
  'reference',
  'governance',
  'characterCreation',
] as const;

export const CONTRIBUTOR_ROLE_TYPES = CONTRIBUTOR_ROLE_TYPE_VALUES as readonly [string, ...string[]];

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
} as const;
