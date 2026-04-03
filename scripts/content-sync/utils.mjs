import path from 'node:path';

export class SupportCodeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SupportCodeError';
    this.supportCode = code;
  }
}

export function info(message) {
  console.log(`ℹ ${message}`);
}

export function ok(message) {
  console.log(`✓ ${message}`);
}

export function warn(message) {
  console.log(`! ${message}`);
}

export function fail(message) {
  console.log(`✗ ${message}`);
}

export function support(code) {
  console.log(`Support code: ${code}`);
}

export function step(title) {
  console.log(`\n=== ${title} ===`);
}

export function normalizePathForDisplay(p) {
  return p.split(path.sep).join('/');
}

export function isDebugEnabled() {
  return process.env.CONTENT_SYNC_DEBUG === '1';
}

export function getSupportCode(error) {
  return error instanceof SupportCodeError ? error.supportCode : null;
}

export function printErrorDetails(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`Reason: ${message}`);

  if (!isDebugEnabled()) {
    return;
  }

  console.log('\n[debug] technical details:');
  console.log(error?.stack || String(error));
}
