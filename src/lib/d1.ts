export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

function isD1DatabaseLike(candidate: unknown): candidate is D1DatabaseLike {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'prepare' in candidate &&
    typeof (candidate as { prepare?: unknown }).prepare === 'function'
  );
}

function getD1BindingFromRuntimeEnvImpl(runtimeEnv: unknown): D1DatabaseLike {
  const candidate =
    runtimeEnv && typeof runtimeEnv === 'object'
      ? (runtimeEnv as Record<string, unknown>).DB
      : undefined;

  if (!isD1DatabaseLike(candidate)) {
    throw new Error('Cloudflare D1 binding "DB" is unavailable in runtime environment');
  }

  return candidate;
}

// Astro v6 (Cloudflare): use cloudflare:workers directly rather than locals.cfContext,
// since cfContext is not reliably populated on Astro.locals for API routes.
async function getD1BindingFromRuntimeEnv(): Promise<D1DatabaseLike> {
  try {
    const { env } = await import('cloudflare:workers');
    return getD1BindingFromRuntimeEnvImpl(env as Record<string, unknown>);
  } catch {
    throw new Error('Cloudflare D1 binding is unavailable: cloudflare:workers env not accessible');
  }
}

export async function getD1BindingFromLocals(_locals: unknown): Promise<D1DatabaseLike> {
  // locals parameter kept for API compatibility but ignored —
  // cloudflare:workers env is the canonical source in Astro v6 Cloudflare.
  return getD1BindingFromRuntimeEnv();
}

export async function tryGetD1BindingFromLocals(locals: unknown): Promise<D1DatabaseLike | null> {
  try {
    return await getD1BindingFromLocals(locals);
  } catch {
    return null;
  }
}
