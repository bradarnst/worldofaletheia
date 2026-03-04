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
  runtime?: RuntimeLike;
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
  const runtime = (locals as LocalsLike | undefined)?.runtime;
  if (!runtime?.env) {
    throw new Error('Cloudflare runtime env is unavailable in Astro.locals.runtime.env');
  }

  return getD1BindingFromRuntimeEnv(runtime.env);
}

export function tryGetD1BindingFromLocals(locals: unknown): D1DatabaseLike | null {
  try {
    return getD1BindingFromLocals(locals);
  } catch {
    return null;
  }
}

