import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Base frontmatter schema for all collections
const baseSchema = z.object({
  status: z.enum(['draft', 'publish', 'archive']),
  author: z.string(),
  created: z.date(),
  modified: z.date().optional(),
  secret: z.boolean(),
  tags: z.array(z.string()).default([]),
  campaign: z.string().optional(),
  permissions: z.enum(['public', 'player', 'gm', 'author']).default('public'),
});

// Collection-specific schemas
const loreSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['mythology', 'history', 'geography', 'culture', 'language']),
  excerpt: z.string().optional(),
});

const placesSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['location', 'landmark', 'dungeon', 'settlement', 'region']),
  excerpt: z.string().optional(),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

const sentientsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['race', 'species', 'culture', 'organization', 'deity']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const bestiarySchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['monster', 'beast', 'spirit', 'construct', 'elemental']),
  excerpt: z.string().optional(),
  challengeRating: z.number().optional(),
});

const floraSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['tree', 'flower', 'fungus', 'herb', 'plant']),
  excerpt: z.string().optional(),
});

const factionsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['guild', 'criminal', 'government', 'religion', 'military', 'police', 'school', 'order']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const systemsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['magic', 'combat', 'skill', 'economy', 'social']),
  excerpt: z.string().optional(),
});

// Campaign schema - only for campaign overview files (not sessions)
const campaignsSchema = baseSchema.omit({ status: true }).extend({
  title: z.string(),
  type: z.enum(['campaign', 'adventure', 'quest', 'story']),
  excerpt: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on-hold', 'cancelled']),
  start: z.date().optional(),
  end: z.date().optional(),
});

// Session schema - for nested session files
const sessionsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['session', 'encounter', 'battle', 'roleplay']),
  excerpt: z.string().optional(),
  campaign: z.string(),
  date: z.date().optional(),
  duration: z.number().optional(), // in minutes
});

// Define all collections with loaders
const lore = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/lore' }),
  schema: loreSchema,
});

const places = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/places' }),
  schema: placesSchema,
});

const sentients = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/sentients' }),
  schema: sentientsSchema,
});

const bestiary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/bestiary' }),
  schema: bestiarySchema,
});

const flora = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/flora' }),
  schema: floraSchema,
});

const factions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/factions' }),
  schema: factionsSchema,
});

const systems = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/systems' }),
  schema: systemsSchema,
});

// Campaigns collection - only campaign overview files (index.md), NOT sessions
// Pattern: any .md file directly in campaign subdirectories, but not in sessions subdirs
const campaigns = defineCollection({
  loader: glob({ 
    pattern: ['**/*.md', '!**/sessions/*.md'], 
    base: 'src/content/campaigns' 
  }),
  schema: campaignsSchema,
});

// Sessions collection - loads from nested sessions folders
const sessions = defineCollection({
  loader: glob({ pattern: '*/sessions/*.md', base: 'src/content/campaigns' }),
  schema: sessionsSchema,
});

const metaSchema = baseSchema.extend({
  title: z.string(),
  excerpt: z.string().optional(),
});

const meta = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/meta' }),
  schema: metaSchema,
});

const pagesSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  tldr: z.string().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content' }),
  schema: pagesSchema,
});

export const collections = {
  lore,
  places,
  sentients,
  bestiary,
  flora,
  factions,
  systems,
  campaigns,
  sessions,
  meta,
  pages,
};
