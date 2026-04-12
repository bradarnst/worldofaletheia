import { describe, expect, it } from 'vitest';
import {
  buildConflictReportFromInspector,
  collectDryRunMetricsFromInspector,
  extractWranglerRowsFromResult,
  interpretNumericRows,
  interpretNumericWranglerResult,
  orderedMigrations,
  parseWranglerRows,
} from './db-migrate-auth-plan.mjs';

function createInspector(options = {}) {
  const numeric = new Map(Object.entries(options.numeric || {}));
  const text = new Map(Object.entries(options.text || {}));
  const tables = new Map(Object.entries(options.tables || {}));

  return {
    queryNumeric(label) {
      if (!numeric.has(label)) {
        return { label, value: 0, error: null };
      }

      return { label, value: numeric.get(label), error: null };
    },
    queryText(sql) {
      return {
        ok: true,
        output: text.get(sql) || '',
        error: null,
      };
    },
    tableExists(tableName) {
      return tables.get(tableName) ?? false;
    },
  };
}

describe('db-migrate-auth-plan wrangler parsing', () => {
  it('extracts rows from mixed Wrangler output with trailing JSON payload', () => {
    const mixedOutput = `
--env staging
[{"results":[{"conflicts":0}],"success":true,"meta":{"duration":1}}]
`;

    expect(parseWranglerRows(mixedOutput)).toEqual({
      rows: [{ conflicts: 0 }],
      error: null,
    });
  });

  it('extracts rows when Wrangler logs and JSON land on different streams', () => {
    const result = {
      status: 0,
      stdout: 'Preparing remote query for staging...\n',
      stderr: '[{"results":[{"ok":1}],"success":true}]\n',
    };

    expect(extractWranglerRowsFromResult(result)).toEqual({
      rows: [{ ok: 1 }],
      error: null,
    });
  });

  it('fails closed when a numeric query has no parseable JSON payload', () => {
    const result = interpretNumericWranglerResult(
      {
        status: 0,
        stdout: '▲ [WARNING] Processing wrangler configuration:\n\n  - missing field in env.staging\n\n1 warning found\n',
        stderr: '',
      },
      'schema_object_conflicts',
    );

    expect(result.value).toBeNull();
    expect(result.error).toContain('unreadable');
    expect(result.error).toContain('not valid JSON');
  });

  it('fails closed when the first row value is non-numeric', () => {
    const result = interpretNumericWranglerResult(
      {
        status: 0,
        stdout: '[{"results":[{"conflicts":"nope"}],"success":true}]',
        stderr: '',
      },
      'schema_object_conflicts',
    );

    expect(result.value).toBeNull();
    expect(result.error).toContain('non-numeric');
  });

  it('fails closed when the Wrangler payload is missing results', () => {
    const result = interpretNumericWranglerResult(
      {
        status: 0,
        stdout: '[{"success":true,"meta":{"duration":1}}]',
        stderr: '',
      },
      'schema_object_conflicts',
    );

    expect(result.value).toBeNull();
    expect(result.error).toContain('results array');
  });

  it('treats empty result sets as an explicit query error', () => {
    expect(interpretNumericRows('schema_object_conflicts', [])).toEqual({
      label: 'schema_object_conflicts',
      value: null,
      error: 'schema_object_conflicts query returned no rows.',
    });
  });

  it('includes migration 0009 in order and keeps 0010 deferred', () => {
    expect(orderedMigrations.at(-1)).toBe('./migrations/0009_campaign_memberships_role_unification.sql');
    expect(orderedMigrations).not.toContain('./migrations/0010_drop_campaign_gm_assignments.sql');
  });

  it('reports invalid membership roles as a blocking conflict', () => {
    const conflicts = buildConflictReportFromInspector(
      createInspector({
        numeric: {
          schema_object_conflicts: 0,
          user_table_exists: 0,
          verification_table_exists: 0,
          campaign_memberships_invalid_role_rows: 2,
        },
        tables: {
          campaign_memberships: true,
        },
      }),
    );

    expect(conflicts).toEqual([
      expect.objectContaining({
        type: 'invalid_membership_roles',
      }),
    ]);
  });

  it('includes role-quality metrics in dry-run output collection', () => {
    const metrics = collectDryRunMetricsFromInspector(
      createInspector({
        numeric: {
          user_table_exists: 0,
          campaign_memberships_table_exists: 1,
          campaign_gm_assignments_table_exists: 1,
          campaign_memberships_total: 4,
          campaign_memberships_member_rows: 3,
          campaign_memberships_gm_rows: 1,
          campaign_memberships_invalid_role_rows: 0,
          campaign_gm_assignments_total: 1,
        },
      }),
    );

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'campaign_memberships_member_rows', value: 3 }),
        expect.objectContaining({ label: 'campaign_memberships_gm_rows', value: 1 }),
        expect.objectContaining({ label: 'campaign_memberships_invalid_role_rows', value: 0 }),
      ]),
    );
  });
});
