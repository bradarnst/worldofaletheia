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

export interface CampaignMembership {
  userId: string;
  campaignSlug: string;
}

export interface CampaignMembershipAccess {
  campaignSlug: string;
  role: 'member' | 'gm';
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function createId(userId: string, campaignSlug: string): string {
  const normalized = `${userId}:${campaignSlug}:${Date.now()}`;
  return normalized.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export class CampaignMembershipRepo {
  constructor(private readonly db: D1DatabaseLike) {}

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
