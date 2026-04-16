import type { APIRoute } from 'astro';
import { sendContactEmail } from '~/lib/email';
import { getNoIndexHeaders } from '@utils/seo';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

interface ContactPayload {
  kind?: 'contact' | 'contribute';
  name: string;
  email: string;
  message: string;
  website?: string;
}

function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitByIp.get(ip);

  if (!existing || now > existing.resetAt) {
    rateLimitByIp.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  existing.count += 1;
  return true;
}

function normalizePayload(payload: unknown): ContactPayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const kind = candidate.kind === 'contribute' ? 'contribute' : 'contact';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const email = typeof candidate.email === 'string' ? candidate.email.trim() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  const website = typeof candidate.website === 'string' ? candidate.website.trim() : undefined;

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !email || !emailIsValid || !message) {
    return null;
  }

  if (name.length > 120 || email.length > 254 || message.length > 5_000) {
    return null;
  }

  return { kind, name, email, message, website };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers: getNoIndexHeaders('application/json'),
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: getNoIndexHeaders('application/json'),
    });
  }

  const normalized = normalizePayload(payload);
  if (!normalized) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_payload' }), {
      status: 400,
      headers: getNoIndexHeaders('application/json'),
    });
  }

  // Honeypot: silently succeed to avoid giving bots useful feedback.
  if (normalized.website) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: getNoIndexHeaders('application/json'),
    });
  }

  try {
    // Astro v6 (Cloudflare): use cfContext for env access.
    const typedLocals = locals as { cfContext?: { env?: Record<string, unknown> } } | undefined;
    const runtimeEnv = typedLocals?.cfContext?.env ?? undefined;

    await sendContactEmail({
      env: runtimeEnv,
      kind: normalized.kind,
      name: normalized.name,
      email: normalized.email,
      message: normalized.message,
      requestId,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: getNoIndexHeaders('application/json'),
    });
  } catch (error) {
    console.error('contact.relay.failed', {
      requestId,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return new Response(JSON.stringify({ ok: false, error: 'unavailable' }), {
      status: 503,
      headers: getNoIndexHeaders('application/json'),
    });
  }
};
