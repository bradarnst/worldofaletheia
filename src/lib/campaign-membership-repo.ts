import { type D1DatabaseLike, getD1BindingFromLocals } from './d1';

interface MembershipRow {
  user_id: string;
  campaign_slug: string;
}

interface MembershipAccessRow {
  campaign_slug: string;
  role: 'member' | 'gm';
}

interface CampaignUserRow {
  user_id: string;
}

interface CampaignMemberRow {
  user_id: string;
  display_name: string | null;
  email: string;
  role: 'member' | 'gm';
  joined_at: string | null;
  updated_at: string | null;
}

interface CampaignGmCountRow {
  gm_count: number;
}

interface ExactEmailUserRow {
  user_id: string;
  display_name: string | null;
  email: string;
}

interface ExistingRoleRow {
  role: 'member' | 'gm';
}

export interface CampaignMembership {
  userId: string;
  campaignSlug: string;
}

export interface CampaignMembershipAccess {
  campaignSlug: string;
  role: 'member' | 'gm';
}

export interface CampaignMemberIdentity {
  userId: string;
  displayName: string | null;
  email: string;
  role: 'member' | 'gm';
  joinedAt: string | null;
  updatedAt: string | null;
}

export interface CampaignMemberListPage {
  items: CampaignMemberIdentity[];
  nextCursor: string | null;
}

export type CampaignMemberMutationOutcome = 'created' | 'updated' | 'unchanged';

export type CampaignMemberCreateOutcome = 'created' | 'already_exists';

export type ExactEmailUserLookup =
  | { status: 'found'; user: { userId: string; displayName: string | null; email: string } }
  | { status: 'not_found' }
  | { status: 'duplicate' };

function toIsoNow(): string {
  return new Date().toISOString();
}

function createId(userId: string, campaignSlug: string): string {
  const normalized = `${userId}:${campaignSlug}:${Date.now()}`;
  return normalized.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function getMutationChangeCount(result: unknown): number | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const meta = (result as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const changes = (meta as { changes?: unknown }).changes;
  return typeof changes === 'number' ? changes : null;
}

export class CampaignMembershipRepo {
  constructor(private readonly db: D1DatabaseLike) {}

  private mapCampaignMember(row: CampaignMemberRow): CampaignMemberIdentity {
    return {
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at,
    };
  }

  async isUserMemberOfCampaign(userId: string, campaignSlug: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT user_id, campaign_slug
         FROM campaign_memberships
         WHERE user_id = ?1 AND campaign_slug = ?2
           AND role IN ('member', 'gm')
         LIMIT 1`,
      )
      .bind(userId, campaignSlug)
      .first<MembershipRow>();

    return Boolean(row);
  }

  async listCampaignMemberships(userId: string): Promise<CampaignMembership[]> {
    const result = await this.db
      .prepare(
        `SELECT user_id, campaign_slug
         FROM campaign_memberships
         WHERE user_id = ?1
         ORDER BY campaign_slug ASC`,
      )
      .bind(userId)
      .all<MembershipRow>();

    return result.results.map((row) => ({
      userId: row.user_id,
      campaignSlug: row.campaign_slug,
    }));
  }

  async listUserCampaignAccess(userId: string): Promise<CampaignMembershipAccess[]> {
    const result = await this.db
      .prepare(
        `SELECT campaign_slug, role
         FROM campaign_memberships
         WHERE user_id = ?1
           AND role IN ('member', 'gm')
         ORDER BY campaign_slug ASC`,
      )
      .bind(userId)
      .all<MembershipAccessRow>();

    return result.results.map((row) => ({
      campaignSlug: row.campaign_slug,
      role: row.role,
    }));
  }

  async isUserGmOfCampaign(userId: string, campaignSlug: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT user_id
         FROM campaign_memberships
         WHERE campaign_slug = ?1 AND user_id = ?2
           AND role = 'gm'
         LIMIT 1`,
      )
      .bind(campaignSlug, userId)
      .first<CampaignUserRow>();

    return Boolean(row);
  }

  async listCampaignGms(campaignSlug: string): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT user_id
         FROM campaign_memberships
         WHERE campaign_slug = ?1
           AND role = 'gm'
         ORDER BY user_id ASC`,
      )
      .bind(campaignSlug)
      .all<CampaignUserRow>();

    return result.results.map((row) => row.user_id);
  }

  async countCampaignGms(campaignSlug: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS gm_count
         FROM campaign_memberships
         WHERE campaign_slug = ?1
           AND role = 'gm'`,
      )
      .bind(campaignSlug)
      .first<CampaignGmCountRow>();

    return row?.gm_count ?? 0;
  }

  async listCampaignMembers(options: {
    campaignSlug: string;
    role?: 'member' | 'gm';
    limit: number;
    cursor?: string | null;
  }): Promise<CampaignMemberListPage> {
    const cursor = options.cursor ?? '';
    const query = options.role
      ? `SELECT
           m.user_id,
           u.name AS display_name,
           u.email,
           m.role,
           m.created_at AS joined_at,
           m.updated_at
         FROM campaign_memberships m
         INNER JOIN "user" u ON u.id = m.user_id
         WHERE m.campaign_slug = ?1
           AND m.role = ?2
           AND m.user_id > ?3
         ORDER BY m.user_id ASC
         LIMIT ?4`
      : `SELECT
           m.user_id,
           u.name AS display_name,
           u.email,
           m.role,
           m.created_at AS joined_at,
           m.updated_at
         FROM campaign_memberships m
         INNER JOIN "user" u ON u.id = m.user_id
         WHERE m.campaign_slug = ?1
           AND m.user_id > ?2
         ORDER BY m.user_id ASC
         LIMIT ?3`;
    const statement = this.db.prepare(query);
    const pageSize = options.limit + 1;
    const result = options.role
      ? await statement.bind(options.campaignSlug, options.role, cursor, pageSize).all<CampaignMemberRow>()
      : await statement.bind(options.campaignSlug, cursor, pageSize).all<CampaignMemberRow>();
    const rows = result.results;
    const pageRows = rows.slice(0, options.limit);
    const nextCursor = rows.length > options.limit ? pageRows.at(-1)?.user_id ?? null : null;

    return {
      items: pageRows.map((row) => this.mapCampaignMember(row)),
      nextCursor,
    };
  }

  async getCampaignMember(campaignSlug: string, userId: string): Promise<CampaignMemberIdentity | null> {
    const row = await this.db
      .prepare(
        `SELECT
           m.user_id,
           u.name AS display_name,
           u.email,
           m.role,
           m.created_at AS joined_at,
           m.updated_at
         FROM campaign_memberships m
         INNER JOIN "user" u ON u.id = m.user_id
         WHERE m.campaign_slug = ?1
           AND m.user_id = ?2
         LIMIT 1`,
      )
      .bind(campaignSlug, userId)
      .first<CampaignMemberRow>();

    return row ? this.mapCampaignMember(row) : null;
  }

  async findUserByExactEmail(canonicalEmail: string): Promise<ExactEmailUserLookup> {
    const result = await this.db
      .prepare(
        `SELECT id AS user_id,
                name AS display_name,
                email
         FROM "user"
         WHERE email = ?1
         ORDER BY id ASC
         LIMIT 2`,
      )
      .bind(canonicalEmail)
      .all<ExactEmailUserRow>();

    if (result.results.length === 0) {
      return { status: 'not_found' };
    }

    if (result.results.length > 1) {
      return { status: 'duplicate' };
    }

    const row = result.results[0];
    return {
      status: 'found',
      user: {
        userId: row.user_id,
        displayName: row.display_name,
        email: row.email,
      },
    };
  }

  async upsertCampaignMember(
    campaignSlug: string,
    userId: string,
    role: 'member' | 'gm',
  ): Promise<CampaignMemberMutationOutcome> {
    const existing = await this.db
      .prepare(
        `SELECT role
         FROM campaign_memberships
         WHERE campaign_slug = ?1
           AND user_id = ?2
         LIMIT 1`,
      )
      .bind(campaignSlug, userId)
      .first<ExistingRoleRow>();

    if (existing?.role === role) {
      return 'unchanged';
    }

    const updatedAt = toIsoNow();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE campaign_memberships
           SET role = ?3,
               updated_at = ?4
           WHERE campaign_slug = ?1
             AND user_id = ?2`,
        )
        .bind(campaignSlug, userId, role, updatedAt)
        .run();

      return 'updated';
    }

    await this.db
      .prepare(
        `INSERT INTO campaign_memberships
         (id, user_id, campaign_slug, role, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(user_id, campaign_slug) DO UPDATE SET
           role = excluded.role,
           updated_at = excluded.updated_at`,
      )
      .bind(createId(userId, campaignSlug), userId, campaignSlug, role, updatedAt)
      .run();

    return 'created';
  }

  async createCampaignMember(
    campaignSlug: string,
    userId: string,
    role: 'member' | 'gm',
  ): Promise<CampaignMemberCreateOutcome> {
    const updatedAt = toIsoNow();
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO campaign_memberships
         (id, user_id, campaign_slug, role, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
      )
      .bind(createId(userId, campaignSlug), userId, campaignSlug, role, updatedAt)
      .run();

    return getMutationChangeCount(result) === 0 ? 'already_exists' : 'created';
  }

  async seedFromMembershipMap(
    memberships: Record<string, { campaigns: string[] | Record<string, 'member' | 'gm'> }>,
  ): Promise<void> {
    const statement = this.db.prepare(
      `INSERT INTO campaign_memberships
       (id, user_id, campaign_slug, role, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(user_id, campaign_slug) DO UPDATE SET
         role = CASE
           WHEN excluded.role = 'gm' THEN 'gm'
           ELSE campaign_memberships.role
         END,
         updated_at = excluded.updated_at`,
    );

    const createdAt = toIsoNow();
    const operations: Promise<unknown>[] = [];

    for (const [userId, entry] of Object.entries(memberships)) {
      const campaignEntries = Array.isArray(entry.campaigns)
        ? entry.campaigns.map((campaignSlug) => [campaignSlug, 'member'] as const)
        : Object.entries(entry.campaigns);

      for (const [campaignSlug, role] of campaignEntries) {
        const id = createId(userId, campaignSlug);
        operations.push(statement.bind(id, userId, campaignSlug, role, createdAt).run());
      }
    }

    await Promise.all(operations);
  }
}

export async function createCampaignMembershipRepoFromLocals(locals: unknown): Promise<CampaignMembershipRepo> {
  const db = await getD1BindingFromLocals(locals);
  return new CampaignMembershipRepo(db);
}
