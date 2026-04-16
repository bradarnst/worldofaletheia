# Astro Actions Form Handling for Contact and Contribute

## Status

- Date: 2026-04-16
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

The site now has lightweight inquiry forms for public contact and contribution requests. The first implementation used page-local client scripts plus a custom `/api/contact` endpoint. That approach worked, but it introduced avoidable duplication and drift:

1. `contact` and `contribute` duplicated form submission workflow logic in page scripts.
2. Client-side validation was inconsistent with server-side validation expectations.
3. The endpoint performed manual JSON parsing and normalization that Astro Actions can handle natively.
4. The current pattern is likely to recur for future lightweight forms, so leaving the first implementation ad hoc would multiply technical debt early.

This project is explicitly Astro-native first. Lightweight form handling should follow the same principle unless a concrete trigger justifies a separate abstraction layer. These forms are server-rendered page concerns, not a signal to introduce service or adapter layers under ADR-0004.

## Decision Drivers

- Keep form handling Astro-native.
- Centralize validation in one reusable schema.
- Remove duplicated client-side fetch and response-mapping logic.
- Preserve server-side rate limiting, honeypot handling, and Mailjet relay behavior.
- Establish a reusable pattern for future public forms.
- Improve maintainability without adding framework or architecture complexity.

## Considered Options

### Option 1: Keep page scripts plus API endpoint

Retain HTML forms with page-local JavaScript, posting JSON to a custom endpoint.

**Pros**

- Already implemented.
- Full control over client-side interaction details.

**Cons**

- Duplicates submission flow logic across pages.
- Validation can drift between client and server.
- More boilerplate than Astro-native actions.

### Option 2: Use Astro Actions with shared Zod validation (Chosen)

Define form handlers in `src/actions/`, validate form input with shared Zod schemas, and render results directly in Astro pages using `Astro.getActionResult()`.

**Pros**

- Native to Astro and aligned with project architecture.
- Shared schema reduces validation drift.
- Eliminates bespoke client fetch logic for simple forms.
- Reusable for `contact`, `contribute`, and future lightweight forms.

**Cons**

- Form pages must be on-demand rendered for HTML form actions.
- Success/error UI becomes request-cycle based unless enhanced further.

### Option 3: Introduce a general form service layer

Create an internal forms service or adapter abstraction under `src/services/` or `src/adapters/`.

**Pros**

- Could standardize multiple future workflows.

**Cons**

- Premature abstraction for current scope.
- Violates current YAGNI guardrails without a concrete trigger.

## Decision Outcome

**Chosen option:** Option 2 - use Astro Actions with shared Zod validation for public inquiry forms.

### Policy

1. Public inquiry forms such as `contact` and `contribute` use Astro Actions as the default submission boundary.
2. Shared input validation lives in reusable Zod schemas rather than duplicated per-page checks.
3. Pages render form status and validation feedback using `Astro.getActionResult()` and `isInputError()`.
4. Native HTML validation attributes remain in place and complement, not replace, server-side Zod validation.
5. Rate limiting, honeypot checks, and email relay execution remain server-side concerns in the action handler.
6. Page-local client scripts are not the default for simple form submission flows; add them only when a concrete UX need justifies progressive enhancement.
7. This decision does not justify populating `src/services/`, `src/adapters/`, or `src/contracts/`.

## Consequences

### Positive

- Form validation and submission flow become more consistent.
- Reusable pattern is established before more forms accumulate bespoke logic.
- Contact and contribute pages become simpler and easier to maintain.
- The implementation remains aligned with Astro-native architecture.

### Negative

- Contact and contribute pages must opt out of prerendering.
- Refresh behavior follows POST semantics unless a future PRG/session pattern is added.

### Neutral

- Mailjet remains the email relay provider per ADR-0006.
- This does not change content collections, routing structure outside the affected pages, or auth boundaries.
- This does not introduce a new cross-cutting application layer.

## Links

- `src/actions/index.ts`
- `src/actions/contact.ts`
- `src/components/forms/InquiryForm.astro`
- `src/pages/contact.astro`
- `src/pages/contribute.astro`
- `plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md`
