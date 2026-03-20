#!/usr/bin/env node

import path from 'node:path';
import { loadConfig } from './config.mjs';
import { buildSyncDiff } from './fs-diff.mjs';
import { askStaleFileAction } from './prompt.mjs';
import { applySync } from './apply-sync.mjs';
import { validateContentTree } from './validate.mjs';
import { createContentCloudAdapter } from './cloud-storage.mjs';
import {
  fail,
  info,
  normalizePathForDisplay,
  ok,
  printErrorDetails,
  step,
  support,
  warn,
} from './utils.mjs';

export function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    dryRun: flags.has('--dry-run'),
    validateOnly: flags.has('--validate-only'),
  };
}

function describeRecordPath(record, repoRoot) {
  if (record.destAbs) {
    return normalizePathForDisplay(path.relative(repoRoot, record.destAbs));
  }
  if (record.mapping.target === 'repo') {
    const base = record.sourceAbs;
    if (!base) {
      return record.relativePath;
    }
    return normalizePathForDisplay(path.relative(repoRoot, base));
  }
  return `cloud://${record.cloudKey || record.relativePath}`;
}

function printDiffReport(diff, repoRoot) {
  info(`Dry-run report: ${diff.counts.new} new, ${diff.counts.updated} updated, ${diff.counts.stale} stale, ${diff.counts.unchanged} unchanged.`);

  const show = (label, rows) => {
    if (!rows.length) return;
    console.log(`
${label}:`);
    for (const row of rows.slice(0, 20)) {
      const p = describeRecordPath(row, repoRoot);
      console.log(`- ${p}`);
    }
    if (rows.length > 20) {
      console.log(`- ...and ${rows.length - 20} more`);
    }
  };

  show('New files', diff.grouped.new);
  show('Updated files', diff.grouped.updated);
  show('Stale files', diff.grouped.stale);
}

async function runValidateOnly(config) {
  step('Validate content');
  const validation = await validateContentTree(config);
  if (!validation.ok) {
    fail('Content checks failed.');
    console.log('Action: fix listed files, then run content sync again.');
    support('VALIDATION-FAILED');
    for (const line of validation.failures) {
      console.log(`- ${line}`);
    }
    if (validation.warnings.length) {
      warn('Warnings:');
      for (const line of validation.warnings.slice(0, 20)) {
        console.log(`- ${line}`);
      }
    }
    process.exitCode = 1;
    return;
  }
  ok(`Validation passed for ${validation.checkedFiles} file(s).`);
}

async function runFullSync(config, { dryRun, services }) {
  step('Scan and diff');
  const diff = await buildSyncDiff(config, services);
  printDiffReport(diff, config.repoRoot);

  if (dryRun) {
    ok('Dry-run complete. No files changed.');
    return;
  }

  let staleAction = null;
  if (diff.grouped.stale.length > 0) {
    step('Stale files decision');
    staleAction = await askStaleFileAction();
    if (staleAction === 'abort') {
      warn('Sync stopped by user before destructive action.');
      support('SYNC-STALE-ABORTED');
      return;
    }
  }

  step('Apply sync');
  const applyResult = await applySync(diff, config, staleAction, services);
  ok(`Applied sync changes to ${applyResult.changedFiles.length} path(s).`);
  if (applyResult.backupRootForRun) {
    info(`Backup created at ${normalizePathForDisplay(path.relative(config.repoRoot, applyResult.backupRootForRun))}`);
  }

  step('Validate content');
  const validation = await validateContentTree(config);
  if (!validation.ok) {
    fail('Content checks failed after sync.');
    console.log('Action: fix listed files, then run sync again.');
    support('VALIDATION-FAILED');
    for (const line of validation.failures) {
      console.log(`- ${line}`);
    }
    if (validation.warnings.length) {
      warn('Warnings:');
      for (const line of validation.warnings.slice(0, 20)) {
        console.log(`- ${line}`);
      }
    }
    process.exitCode = 1;
    return;
  }
  ok(`Validation passed for ${validation.checkedFiles} file(s).`);
  if (validation.warnings.length) {
    warn(`Validation warnings: ${validation.warnings.length}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  try {
    const config = await loadConfig({ requireCloudCredentials: !args.validateOnly });

    if (args.validateOnly) {
      await runValidateOnly(config);
      return;
    }

    const services = {};
    if (config.hasCloudMappings) {
      services.cloud = createContentCloudAdapter(config.contentCloud);
    }

    await runFullSync(config, { dryRun: args.dryRun, services });
  } catch (error) {
    fail('Content sync failed.');
    console.log('Action: check the message above and retry.');
    support('SYNC-RUNTIME-ERROR');
    printErrorDetails(error);
    process.exitCode = 1;
  }
}

main();
