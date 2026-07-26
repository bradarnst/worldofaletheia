function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePathSegments(value) {
  return normalizeIdentifier(value)
    .split('\\').join('/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isRetiredCampaignCollection(collection) {
  const normalized = normalizeIdentifier(collection);
  return normalized === 'sessions' || normalized === 'campaigns' || normalized.startsWith('campaign');
}

export function getRetiredCampaignMappingReason(mapping) {
  if (isRetiredCampaignCollection(mapping?.collection)) {
    return `collection "${String(mapping.collection).trim()}" is retired`;
  }

  const retiredDestination = normalizePathSegments(mapping?.to).find(isRetiredCampaignCollection);
  if (retiredDestination) {
    return `destination segment "${retiredDestination}" is retired`;
  }

  const retiredSource = normalizePathSegments(mapping?.from).find(isRetiredCampaignCollection);
  return retiredSource ? `source segment "${retiredSource}" is retired` : null;
}

export function assertActiveContentMapping(mapping) {
  const reason = getRetiredCampaignMappingReason(mapping);
  if (!reason) {
    return;
  }

  const from = String(mapping?.from || '<unknown source>').trim();
  const to = String(mapping?.to || '<unknown destination>').trim();
  throw new Error(
    `Retired Campaign Content mapping rejected (${from} -> ${to}): ${reason}. ` +
      'Campaign Content is owned by woa-admin and must not use the repo content-sync pipeline.',
  );
}
