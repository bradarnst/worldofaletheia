export async function getCloudflareRuntimeEnv(): Promise<Record<string, unknown> | undefined> {
  try {
    const module = await import('cloudflare:workers');
    const runtimeEnv = (module as { env?: unknown }).env;
    if (!runtimeEnv || typeof runtimeEnv !== 'object') {
      return undefined;
    }

    return runtimeEnv as Record<string, unknown>;
  } catch {
    // `cloudflare:workers` is only available in the Cloudflare runtime lane.
    return undefined;
  }
}
