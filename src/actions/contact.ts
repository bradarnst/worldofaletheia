import type { ActionAPIContext } from 'astro:actions';
import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { sendContactEmail } from '~/lib/email';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

const formKindSchema = z.enum(['contact', 'contribute']);

const sharedInquirySchema = z.object({
  kind: formKindSchema,
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name must be 120 characters or fewer.'),
  email: z.email('Enter a valid email address.').max(254, 'Email must be 254 characters or fewer.'),
  message: z.string().trim().min(1, 'Message is required.').max(5000, 'Message must be 5000 characters or fewer.'),
  website: z.string().trim().max(500).nullish().transform((value) => value ?? ''),
});

const contactInquirySchema = sharedInquirySchema.superRefine((input, ctx) => {
  if (input.kind === 'contact' && input.message.length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message'],
      message: 'Add a little more detail so the message can be understood and answered.',
    });
  }

  if (input.kind === 'contribute' && input.message.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message'],
      message: 'Add a bit more detail so the contribution request can be reviewed effectively.',
    });
  }
});

type ContactInquiryInput = z.infer<typeof contactInquirySchema>;

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

async function submitInquiry(input: ContactInquiryInput, context: ActionAPIContext) {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(context.request);

  if (!checkRateLimit(ip)) {
    throw new ActionError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many submissions were sent from this connection. Wait a minute and try again.',
    });
  }

  if (input.website) {
    return {
      ok: true,
      status: 'sent' as const,
      kind: input.kind,
    };
  }

  const typedLocals = context.locals as { cfContext?: { env?: Record<string, unknown> } } | undefined;
  const runtimeEnv = typedLocals?.cfContext?.env ?? undefined;

  try {
    await sendContactEmail({
      env: runtimeEnv,
      kind: input.kind,
      name: input.name,
      email: input.email,
      message: input.message,
      requestId,
    });

    return {
      ok: true,
      status: 'sent' as const,
      kind: input.kind,
    };
  } catch (error) {
    console.error('contact.relay.failed', {
      requestId,
      message: error instanceof Error ? error.message : 'unknown error',
      kind: input.kind,
    });

    throw new ActionError({
      code: 'SERVICE_UNAVAILABLE',
      message: input.kind === 'contribute'
        ? 'The contribution relay is temporarily unavailable. Try again later or use the email listed on About.'
        : 'The contact relay is temporarily unavailable. Try again later or use the email listed on About.',
    });
  }
}

const contact = defineAction({
  accept: 'form',
  input: contactInquirySchema,
  handler: submitInquiry,
});

export { contactInquirySchema, formKindSchema };

export const contactActions = {
  submit: contact,
};
