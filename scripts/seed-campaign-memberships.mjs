import membershipConfigJson from '../src/content/campaigns/access.config.json' with { type: 'json' };

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
    if (!Array.isArray(campaignsRaw)) {
      continue;
    }

    const campaigns = campaignsRaw.filter((item) => typeof item === 'string' && item.length > 0);
    if (campaigns.length === 0) {
      continue;
    }

    normalized[userId] = campaigns;
  }

  return normalized;
}

function createInsertStatements(config) {
  const nowIso = new Date().toISOString();
  const statements = [];

  for (const [userId, campaigns] of Object.entries(config)) {
    for (const campaignSlug of campaigns) {
      const id = `${userId}:${campaignSlug}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
      statements.push(
        `INSERT OR IGNORE INTO campaign_memberships (id, user_id, campaign_slug, role, created_at)
VALUES ('${id}', '${userId}', '${campaignSlug}', 'member', '${nowIso}');`,
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

