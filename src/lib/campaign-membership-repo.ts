import { type D1DatabaseLike, getD1BindingFromLocals } from './d1';

interface MembershipRow {
  user_id: string;
  campaign_slug: string;
}

interface GmAssignmentRow {
  user_id: string;
}

export interface CampaignMembership {
  userId: string;
  campaignSlug: string;
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

  async isUserGmOfCampaign(userId: string, campaignSlug: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT user_id
         FROM campaign_gm_assignments
         WHERE campaign_slug = ?1 AND user_id = ?2
         LIMIT 1`,
      )
      .bind(campaignSlug, userId)
      .first<GmAssignmentRow>();

    return Boolean(row);
  }

  async listCampaignGms(campaignSlug: string): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT user_id
         FROM campaign_gm_assignments
         WHERE campaign_slug = ?1
         ORDER BY user_id ASC`,
      )
      .bind(campaignSlug)
      .all<GmAssignmentRow>();

    return result.results.map((row) => row.user_id);
  }

  async seedFromMembershipMap(memberships: Record<string, { campaigns: string[] }>): Promise<void> {
    const statement = this.db.prepare(
      `INSERT OR IGNORE INTO campaign_memberships
       (id, user_id, campaign_slug, role, created_at)
       VALUES (?1, ?2, ?3, 'member', ?4)`,
    );

    const createdAt = toIsoNow();
    const operations: Promise<unknown>[] = [];

    for (const [userId, entry] of Object.entries(memberships)) {
      for (const campaignSlug of entry.campaigns) {
        const id = createId(userId, campaignSlug);
        operations.push(statement.bind(id, userId, campaignSlug, createdAt).run());
      }
    }

    await Promise.all(operations);
  }
}

export async function createCampaignMembershipRepoFromLocals(locals: unknown): Promise<CampaignMembershipRepo> {
  const db = await getD1BindingFromLocals(locals);
  return new CampaignMembershipRepo(db);
}
