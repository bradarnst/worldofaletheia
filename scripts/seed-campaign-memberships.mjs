import membershipConfigJson from '../config/campaign-access.config.json' with { type: 'json' };

function normalizeMembershipConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return {};
  }

  const memberships = rawConfig.memberships;
  if (!memberships || typeof memberships !== 'object' || Array.isArray(memberships)) {
    return {};
  }

  const normalized = {};
  for (const [userId, value] of Object.entries(memberships)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const campaignsRaw = value.campaigns;
    const campaigns = {};

    if (Array.isArray(campaignsRaw)) {
      for (const item of campaignsRaw) {
        if (typeof item !== 'string' || item.length === 0) {
          continue;
        }

        campaigns[item] = 'member';
      }
    } else if (campaignsRaw && typeof campaignsRaw === 'object') {
      for (const [campaignSlug, role] of Object.entries(campaignsRaw)) {
        if (!campaignSlug || (role !== 'member' && role !== 'gm')) {
          continue;
        }

        campaigns[campaignSlug] = role;
      }
    }

    if (Object.keys(campaigns).length === 0) {
      continue;
    }

    normalized[userId] = campaigns;
  }

  return normalized;
}

function toSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createInsertStatements(config) {
  const nowIso = new Date().toISOString();
  const statements = [];

  for (const [userId, campaigns] of Object.entries(config)) {
    for (const [campaignSlug, role] of Object.entries(campaigns)) {
      const id = `${userId}:${campaignSlug}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
      statements.push(
        `INSERT OR IGNORE INTO campaign_memberships (id, user_id, campaign_slug, role, created_at)
VALUES (${toSqlString(id)}, ${toSqlString(userId)}, ${toSqlString(campaignSlug)}, ${toSqlString(role)}, ${toSqlString(nowIso)});`,
      );
    }
  }

  return statements;
}

const normalized = normalizeMembershipConfig(membershipConfigJson);
const statements = createInsertStatements(normalized);

if (statements.length === 0) {
  console.log('-- No membership seeds to apply');
  process.exit(0);
}

console.log(statements.join('\n'));
