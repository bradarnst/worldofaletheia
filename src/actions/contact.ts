import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

const contactSchema = z.object({
  kind: z.enum(['contact', 'contribute']),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  message: z.string().trim().min(5).max(5000),
  website: z.string().trim().max(500).nullish(), // honeypot
});

const contact = defineAction({
  accept: 'form',
  input: contactSchema,
  handler: async (input) => {
    // Honeypot — bots fill this, real users don't
    if (input.website) {
      return { ok: true, kind: input.kind };
    }

    // Get env from Cloudflare Workers runtime
    const { env } = await import('cloudflare:workers');
    const apiKey = env.MAILJET_API_KEY as string;
    const secretKey = env.MAILJET_SECRET_KEY as string;
    const from = env.EMAIL_FROM as string;
    const to = env.CONTACT_TO_EMAIL as string;

    const auth = 'Basic ' + btoa(`${apiKey}:${secretKey}`);

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: from },
          To: to.split(',').map((e) => ({ Email: e.trim() })),
          ReplyTo: { Email: input.email },
          Subject: `Aletheia ${input.kind} form: ${input.name}`,
          TextPart: input.message,
        }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Mailjet error:', response.status, body);
      throw new ActionError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'The contact relay is temporarily unavailable. Try again later.',
      });
    }

    return { ok: true, kind: input.kind };
  },
});

export const contactActions = {
  submit: contact,
};
