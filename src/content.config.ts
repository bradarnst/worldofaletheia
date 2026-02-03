import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Base frontmatter schema for all collections
const baseSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  author: z.string(),
  created: z.date(),
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

const creaturesSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['monster', 'beast', 'spirit', 'construct', 'elemental']),
  excerpt: z.string().optional(),
  challengeRating: z.number().optional(),
});

const factionsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['guild', 'kingdom', 'cult', 'mercenary', 'criminal']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const systemsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['magic', 'combat', 'skill', 'economy', 'social']),
  excerpt: z.string().optional(),
});

const campaignsSchema = baseSchema.omit({ status: true }).extend({
  title: z.string(),
  type: z.enum(['campaign', 'adventure', 'quest', 'story']),
  excerpt: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on-hold', 'cancelled']),
  start: z.date().optional(),
  end: z.date().optional(),
});

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

const creatures = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/creatures' }),
  schema: creaturesSchema,
});

const factions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/factions' }),
  schema: factionsSchema,
});

const systems = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/systems' }),
  schema: systemsSchema,
});

const campaigns = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/campaigns' }),
  schema: campaignsSchema,
});

const sessions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/sessions' }),
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

export const collections = {
  lore,
  places,
  sentients,
  creatures,
  factions,
  systems,
  campaigns,
  sessions,
  meta,
};
