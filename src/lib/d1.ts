export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

interface RuntimeLike {
  env?: Record<string, unknown>;
}

interface LocalsLike {
  cfContext?: RuntimeLike;
  runtime?: RuntimeLike;
}

function getRuntimeEnvFromLocals(locals: unknown): Record<string, unknown> | null {
  const typedLocals = (locals as LocalsLike | undefined) ?? {};

  if (typedLocals.cfContext?.env) {
    return typedLocals.cfContext.env;
  }

  // Backward-compatible fallback for older adapter/runtime combinations.
  if (typedLocals.runtime?.env) {
    return typedLocals.runtime.env;
  }

  return null;
}

function isD1DatabaseLike(candidate: unknown): candidate is D1DatabaseLike {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'prepare' in candidate &&
    typeof (candidate as { prepare?: unknown }).prepare === 'function'
  );
}

export function getD1BindingFromRuntimeEnv(runtimeEnv: unknown): D1DatabaseLike {
  const candidate =
    runtimeEnv && typeof runtimeEnv === 'object'
      ? (runtimeEnv as Record<string, unknown>).DB
      : undefined;

  if (!isD1DatabaseLike(candidate)) {
    throw new Error('Cloudflare D1 binding "DB" is unavailable in runtime environment');
  }

  return candidate;
}

export function getD1BindingFromLocals(locals: unknown): D1DatabaseLike {
  const runtimeEnv = getRuntimeEnvFromLocals(locals);
  if (!runtimeEnv) {
    throw new Error('Cloudflare runtime env is unavailable in Astro.locals.cfContext.env');
  }

  return getD1BindingFromRuntimeEnv(runtimeEnv);
}

export function tryGetD1BindingFromLocals(locals: unknown): D1DatabaseLike | null {
  try {
    return getD1BindingFromLocals(locals);
  } catch {
    return null;
  }
}
