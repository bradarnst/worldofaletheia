import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { createR2MarkdownCollectionLoader } from './lib/r2-content-loader.mjs';
import { resolveCollectionSource } from './lib/content-source-mode';
import { parseAletheiaDate, toAbsDay } from './lib/aletheia-calendar';
import {
  LORE_TYPES,
  PLACES_TYPES,
  SENTIENTS_TYPES,
  BESTIARY_TYPES,
  FLORA_TYPES,
  FACTIONS_TYPES,
  SYSTEMS_TYPES,
  META_TYPES,
  CONTRIBUTOR_ROLE_TYPES,
} from './lib/content-types';

const legacyStatusSchema = z.enum([
  'draft',
  'review',
  'publish',
  'published',
  'archive',
  'archived',
  'planning',
  'active',
  'completed',
  'on-hold',
  'cancelled',
]);

const publicationSchema = z.enum(['preview', 'publish', 'archive']);
const contentStateSchema = z.enum(['stable', 'mayChange', 'unfinished']);
const audienceWarningSchema = z.enum(['gmSpoilers']);
const optionalExcerptSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().optional(),
);

// Strict RFC 3339 date-time string. Accepts either UTC `Z` or explicit numeric
// offset (e.g. `+02:00`). Transforms to a `Date` for downstream runtime use.
// Authored source of truth lives in docs/content-field-naming-conventions.md.
const requiredRfc3339DateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

function createMarkdownLoader(collection: string, pattern: string, base: string) {
  if (resolveCollectionSource(collection) === 'cloud') {
    return createR2MarkdownCollectionLoader(collection);
  }

  return glob({ pattern, base });
}

// Base frontmatter schema for all collections
const baseSchema = z.object({
  collection: z.string().trim().min(1),
  publication: publicationSchema.optional(),
  contentState: contentStateSchema.optional().default('stable'),
  audienceWarnings: z.array(audienceWarningSchema).optional().default([]),
  // Legacy migration input only. Runtime filtering derives publication from this field
  // only when publication is not present; access control must never use it.
  status: legacyStatusSchema.optional(),
  authors: z.array(z.string()).min(1),
  contributors: z.array(z.object({
    id: z.string(),
    roles: z.array(z.enum(CONTRIBUTOR_ROLE_TYPES)).min(1),
  })).optional().default([]),
  createdAt: requiredRfc3339DateTime,
  updatedAt: requiredRfc3339DateTime,
  // Deprecated: retained only for backward compatibility with existing content files.
  // Access control enforcement must ignore this field.
  secret: z.boolean().optional().default(false),
  tags: z.array(z.string()).default([]),
  campaign: z.string().optional(),
  // Deprecated role label metadata: never used as an authorization gate.
  permissions: z.enum(['public', 'player', 'gm', 'author']).optional().default('public'),
  // Informational only for non-campaign domains (Canon/Using).
  // Never used by authorization checks.
  gmResource: z.boolean().optional().default(false),
  // Legacy informational fields from previous metadata style.
  // Preserved as optional honor-system metadata for UI labeling and filtering only.
  gm: z.boolean().optional(),
  'gm-date': z.string().optional(),
  'gm-info': z.union([z.boolean(), z.string()]).optional(),
  parentChain: z.array(z.object({
    label: z.string(),
    href: z.string(),
  })).optional(),
  relationships: z.array(z.object({
    label: z.string(),
    href: z.string(),
    kind: z.enum(['partOf', 'connectedTo']).optional(),
    reason: z.string().optional(),
  })).optional(),
});

const contributorsSchema = z.object({
  collection: z.literal('contributors'),
  title: z.string(),
  displayName: z.string().optional(),
  aliases: z.array(z.string()).optional().default([]),
  publication: publicationSchema.optional(),
  contentState: contentStateSchema.optional().default('stable'),
  audienceWarnings: z.array(audienceWarningSchema).optional().default([]),
  // Legacy migration input only.
  status: legacyStatusSchema.optional(),
  createdAt: requiredRfc3339DateTime,
  updatedAt: requiredRfc3339DateTime,
  avatar: z.string().optional(),
  bioExcerpt: z.string().optional(),
  socials: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).optional().default([]),
  profileMode: z.enum(['standard', 'featured']),
  featuredContributions: z.array(z.object({
    collection: z.string(),
    slug: z.string(),
  })).optional().default([]),
});

const loreSchema = baseSchema.extend({
  collection: z.literal('lore'),
  title: z.string(),
  type: z.enum(LORE_TYPES),
  excerpt: optionalExcerptSchema,
  aletheia_date: z.string().trim().min(1).optional(),
  aletheia_date_end: z.string().trim().min(1).optional(),
}).superRefine((data, ctx) => {
  const hasStartDate = Boolean(data.aletheia_date);
  const hasEndDate = Boolean(data.aletheia_date_end);
  const startDate = hasStartDate ? parseAletheiaDate(data.aletheia_date ?? '') : null;
  const endDate = hasEndDate ? parseAletheiaDate(data.aletheia_date_end ?? '') : null;

  if (data.type === 'event') {
    if (!hasStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date'],
        message: 'Lore entries with type event must define aletheia_date.',
      });
    }

    if (hasStartDate && !startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date'],
        message: 'aletheia_date must be a valid Aletheia calendar date.',
      });
    }

    if (hasEndDate && !endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date_end'],
        message: 'aletheia_date_end must be a valid Aletheia calendar date.',
      });
    }

    if (startDate && endDate && toAbsDay(endDate) < toAbsDay(startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date_end'],
        message: 'aletheia_date_end must be on or after aletheia_date.',
      });
    }

    return;
  }

  if (hasStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aletheia_date'],
      message: 'Only lore entries with type event may define aletheia_date.',
    });
  }

  if (hasEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aletheia_date_end'],
      message: 'Only lore entries with type event may define aletheia_date_end.',
    });
  }
});

const placesSchema = baseSchema.extend({
  collection: z.literal('places'),
  title: z.string(),
  type: z.enum(PLACES_TYPES),
  excerpt: optionalExcerptSchema,
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

const sentientsSchema = baseSchema.extend({
  collection: z.literal('sentients'),
  title: z.string(),
  type: z.enum(SENTIENTS_TYPES),
  excerpt: optionalExcerptSchema,
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const bestiarySchema = baseSchema.extend({
  collection: z.literal('bestiary'),
  title: z.string(),
  type: z.enum(BESTIARY_TYPES),
  excerpt: optionalExcerptSchema,
  challengeRating: z.number().optional(),
});

const floraSchema = baseSchema.extend({
  collection: z.literal('flora'),
  title: z.string(),
  type: z.enum(FLORA_TYPES),
  excerpt: optionalExcerptSchema,
});

const factionsSchema = baseSchema.extend({
  collection: z.literal('factions'),
  title: z.string(),
  type: z.enum(FACTIONS_TYPES),
  excerpt: optionalExcerptSchema,
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const systemsSchema = baseSchema.extend({
  collection: z.literal('systems'),
  title: z.string(),
  type: z.enum(SYSTEMS_TYPES),
  subtype: z.enum(['magic', 'combat', 'skill', 'language', 'character', 'economy', 'social', 'equipment']),
  excerpt: optionalExcerptSchema,
});

const metaSchema = baseSchema.extend({
  collection: z.literal('meta'),
  title: z.string(),
  type: z.enum(META_TYPES).default('info'),
  excerpt: optionalExcerptSchema,
});

const lore = defineCollection({
  loader: createMarkdownLoader('lore', '**/*.md', 'src/content/lore'),
  schema: loreSchema,
});

const places = defineCollection({
  loader: createMarkdownLoader('places', '**/*.md', 'src/content/places'),
  schema: placesSchema,
});

const sentients = defineCollection({
  loader: createMarkdownLoader('sentients', '**/*.md', 'src/content/sentients'),
  schema: sentientsSchema,
});

const bestiary = defineCollection({
  loader: createMarkdownLoader('bestiary', '**/*.md', 'src/content/bestiary'),
  schema: bestiarySchema,
});

const flora = defineCollection({
  loader: createMarkdownLoader('flora', '**/*.md', 'src/content/flora'),
  schema: floraSchema,
});

const factions = defineCollection({
  loader: createMarkdownLoader('factions', '**/*.md', 'src/content/factions'),
  schema: factionsSchema,
});

const systems = defineCollection({
  loader: createMarkdownLoader('systems', '**/*.md', 'src/content/systems'),
  schema: systemsSchema,
});

const meta = defineCollection({
  loader: createMarkdownLoader('meta', '**/*.md', 'src/content/meta'),
  schema: metaSchema,
});

const contributors = defineCollection({
  loader: createMarkdownLoader('contributors', '**/*.md', 'src/content/contributors'),
  schema: contributorsSchema,
});


export const collections = {
  lore,
  places,
  sentients,
  bestiary,
  flora,
  factions,
  systems,
  meta,
  contributors,
};
