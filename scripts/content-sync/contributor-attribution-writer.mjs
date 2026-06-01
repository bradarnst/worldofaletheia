function quoteSqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function dedupeRows(rows, keyBuilder) {
  const rowMap = new Map();
  for (const row of rows) {
    rowMap.set(keyBuilder(row), row);
  }
  return [...rowMap.values()];
}

function assertKnownAttributionContributors({ contributorRows, attributionRows, managedCollections }) {
  if (!managedCollections.includes('contributors')) {
    return;
  }

  const contributorIds = new Set(contributorRows.map((row) => row.id));
  const unknownContributorIds = [
    ...new Set(attributionRows.map((row) => row.contributorId).filter((id) => !contributorIds.has(id))),
  ].sort((left, right) => left.localeCompare(right));

  if (unknownContributorIds.length === 0) {
    return;
  }

  throw new Error(
    `Attribution sync references unknown contributor id(s): ${unknownContributorIds.join(', ')}. ` +
      'Add matching contributor profile markdown under the contributors collection or fix the author/contributors frontmatter before syncing.',
  );
}

export function buildContributorAttributionSyncPlan({ contributorRows = [], attributionRows = [], managedCollections = [] }) {
  const dedupedContributorRows = dedupeRows(contributorRows, (row) => row.id).sort((left, right) => left.id.localeCompare(right.id));
  const dedupedAttributionRows = dedupeRows(
    attributionRows,
    (row) => `${row.contributorId}\u0000${row.targetType}\u0000${row.targetCollection}\u0000${row.targetId}\u0000${row.role}`,
  ).sort(
    (left, right) =>
      left.targetCollection.localeCompare(right.targetCollection) ||
      left.targetId.localeCompare(right.targetId) ||
      left.contributorId.localeCompare(right.contributorId) ||
      left.role.localeCompare(right.role),
  );
  const normalizedManagedCollections = [...new Set(managedCollections)].sort((left, right) => left.localeCompare(right));

  assertKnownAttributionContributors({
    contributorRows: dedupedContributorRows,
    attributionRows: dedupedAttributionRows,
    managedCollections: normalizedManagedCollections,
  });

  return {
    contributorRows: dedupedContributorRows,
    attributionRows: dedupedAttributionRows,
    managedCollections: normalizedManagedCollections,
  };
}

export function buildContributorRegistrySql(plan) {
  const statements = [];
  const syncContributorIds = plan.contributorRows.map((row) => row.id);

  if (plan.managedCollections.includes('contributors')) {
    if (syncContributorIds.length > 0) {
      statements.push(
        `DELETE FROM contributors WHERE r2_key IS NOT NULL AND source_id IS NOT NULL AND source_id NOT IN (${syncContributorIds
          .map(quoteSqlLiteral)
          .join(', ')});`,
      );
    } else {
      statements.push('DELETE FROM contributors WHERE r2_key IS NOT NULL AND source_id IS NOT NULL;');
    }
  }

  for (const row of plan.contributorRows) {
    statements.push(`
INSERT INTO contributors (
  id,
  display_name,
  title,
  status,
  profile_mode,
  bio_excerpt,
  avatar,
  source_id,
  r2_key,
  indexed_at
)
VALUES (
  ${quoteSqlLiteral(row.id)},
  ${quoteSqlLiteral(row.displayName)},
  ${quoteSqlLiteral(row.title)},
  ${quoteSqlLiteral(row.status)},
  ${quoteSqlLiteral(row.profileMode)},
  ${quoteSqlLiteral(row.bioExcerpt)},
  ${quoteSqlLiteral(row.avatar)},
  ${quoteSqlLiteral(row.sourceId)},
  ${quoteSqlLiteral(row.r2Key)},
  ${quoteSqlLiteral(row.indexedAt)}
)
ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name,
  title = excluded.title,
  status = excluded.status,
  profile_mode = excluded.profile_mode,
  bio_excerpt = excluded.bio_excerpt,
  avatar = excluded.avatar,
  source_id = excluded.source_id,
  r2_key = excluded.r2_key,
  indexed_at = excluded.indexed_at;`.trim());
  }

  return statements.join('\n');
}

export function buildAttributionDeleteSql(collection) {
  return `DELETE FROM attributions WHERE target_type = 'content' AND target_collection = ${quoteSqlLiteral(collection)};`;
}

export function buildAttributionInsertSql(plan, { collection } = {}) {
  const statements = [];
  const rows = collection
    ? plan.attributionRows.filter((row) => row.targetCollection === collection)
    : plan.attributionRows;

  for (const row of rows) {
    statements.push(`
INSERT INTO attributions (
  contributor_id,
  target_type,
  target_collection,
  target_id,
  role,
  indexed_at
)
VALUES (
  ${quoteSqlLiteral(row.contributorId)},
  ${quoteSqlLiteral(row.targetType)},
  ${quoteSqlLiteral(row.targetCollection)},
  ${quoteSqlLiteral(row.targetId)},
  ${quoteSqlLiteral(row.role)},
  ${quoteSqlLiteral(row.indexedAt)}
)
ON CONFLICT(contributor_id, target_type, target_collection, target_id, role) DO UPDATE SET
  indexed_at = excluded.indexed_at;`.trim());
  }

  return statements.join('\n');
}
