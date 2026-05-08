---
name: mailjet-email-audit
description: Analyze a codebase and concisely describe how it sends email with Mailjet, including contact forms, auth/config, request flow, safeguards, and failure behavior.
---

# Mailjet Email Audit

Use this skill when asked to explain how a project sends emails through Mailjet.

## Goal

Produce a concise, precise summary of the project's Mailjet-based email flow.

## What to inspect

1. `package.json`
   - Check whether the project uses a Mailjet SDK or plain HTTP/fetch.

2. Environment definitions
   - Look for env typings and runtime bindings:
     - `src/env.d.ts`
     - framework/runtime env files
     - Cloudflare/Vercel/server env access patterns

3. Mail entry points
   - Search for:
     - `mailjet`
     - `MAILJET_`
     - `sendEmail`
     - `sendContactEmail`
     - `contact`
     - `verification`
     - `email`

4. User-facing entry pages/forms
   - Identify where contact/contribute/auth forms are rendered.
   - Determine whether they post to:
     - server actions
     - API routes
     - server endpoints
     - form handlers

5. Server-side relay logic
   - Trace the full path from form/API entry to Mailjet request.
   - Extract:
     - endpoint URL
     - auth method
     - message payload shape
     - recipients
     - reply-to behavior
     - subject/body composition

6. Safeguards and failure handling
   - Validation
   - rate limiting
   - honeypots / anti-spam
   - logging
   - user-facing error messages
   - sandbox/test mode

7. Other Mailjet uses
   - Account verification
   - password reset
   - notifications
   - admin alerts

## Output format

Return bullets under these headings:

- **Entry point**
- **Server flow**
- **Mailjet transport**
- **Required env**
- **Message shape**
- **Protections**
- **Failure behavior**
- **Other Mailjet uses**

## Rules

- Be precise; do not speculate.
- Distinguish confirmed behavior from inference.
- Prefer “uses plain fetch to Mailjet” vs “uses Mailjet” when that is the real implementation.
- Mention if there is **no Mailjet SDK**.
- Mention runtime source of env when relevant (e.g. `import.meta.env`, Cloudflare `env`, process env).
- If Mailjet is not actually present, say so clearly.

## Example summary shape

- **Entry point:** `/contact` renders a form that posts to a server action.
- **Server flow:** form → validation/rate-limit/honeypot → mail helper → Mailjet API.
- **Mailjet transport:** direct `fetch()` POST to `https://api.mailjet.com/v3.1/send` using Basic Auth.
- **Required env:** `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL`.
- **Message shape:** From = project sender, To = configured inbox, Reply-To = submitter, plain-text body.
- **Protections:** Zod validation, IP rate limiting, hidden honeypot field.
- **Failure behavior:** logs relay failure and returns generic unavailable message.
- **Other Mailjet uses:** verification email flow.
