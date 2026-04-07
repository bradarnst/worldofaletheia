import { describe, expect, it } from 'vitest';
import {
  extractWranglerRowsFromResult,
  interpretNumericRows,
  interpretNumericWranglerResult,
  parseWranglerRows,
} from './db-migrate-auth-plan.mjs';

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
});
