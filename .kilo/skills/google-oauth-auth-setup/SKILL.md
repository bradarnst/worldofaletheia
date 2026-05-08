---
name: google-oauth-auth-setup
description: Analyze or implement Google OAuth authentication setup in a web app, covering provider config, env variables, callback routes, session integration, redirects, security checks, and local/production verification.
---

# Google OAuth Auth Setup

Use this skill when asked to set up, review, or explain Google OAuth for authentication.

## Goal

Produce a concise, implementation-ready plan or assessment for adding Google OAuth sign-in correctly and securely.

## What to inspect

1. Project foundations
   - `package.json`
   - framework/runtime entry points
   - auth libraries already in use
   - deployment/runtime platform

2. Existing auth architecture
   - Search for:
     - `auth`
     - `oauth`
     - `google`
     - `callback`
     - `session`
     - `signin`
     - `login`
     - `logout`
     - `BETTER_AUTH`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
   - Determine whether the project already has:
     - session handling
     - user model / identity store
     - auth middleware
     - protected routes

3. Google OAuth integration points
   - Provider registration/config
   - callback URL handling
   - login initiation route/button
   - logout/session invalidation path
   - post-login redirect behavior

4. Environment and secrets
   - Identify required variables such as:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - app base URL / auth URL
     - session/auth secret
   - Identify where env is read:
     - `import.meta.env`
     - runtime env bindings
     - `process.env`

5. Persistence and identity mapping
   - How OAuth identities map to local users
   - Whether first login creates a user automatically
   - Whether email verification/trust is delegated to Google
   - How account linking is handled, if at all

6. Security checks
   - CSRF/state handling
   - redirect URI correctness
   - cookie/session security
   - trusted origin/base URL config
   - minimum scopes
   - handling missing/invalid callback params

7. UX and routing
   - login button placement
   - error states
   - success redirects
   - protected route behavior when unauthenticated

8. Verification steps
   - local dev callback flow
   - staging/prod callback flow
   - sign-in success
   - logout success
   - session persistence
   - protected page access

## Output format

Return bullets under these headings:

- **Current auth baseline**
- **Required Google OAuth config**
- **Required env**
- **Server/auth flow**
- **Routes and callbacks**
- **Session/user handling**
- **Security requirements**
- **Verification checklist**
- **Gaps or risks**

## Rules

- Be precise; do not speculate.
- Prefer the project's existing auth library and runtime patterns over introducing new abstractions.
- Do not recommend adding a new auth framework unless the project clearly lacks one.
- Distinguish between what is already implemented and what must still be configured.
- Mention exact callback/auth URLs when they can be derived from the codebase.
- Mention exact scopes only if they are present or clearly required.
- Keep recommendations minimal and compatible with the existing architecture.
- If Google OAuth is partially configured, explain the missing pieces rather than restating generic setup steps.

## Common setup checklist

1. Create Google OAuth credentials in Google Cloud.
2. Configure authorized JavaScript origins if applicable.
3. Configure authorized redirect URI(s) to the app's auth callback.
4. Add required env vars to local and deployed environments.
5. Register Google as an auth provider in the existing auth layer.
6. Ensure callback route exchanges code and establishes a session.
7. Redirect the user to the correct post-login destination.
8. Verify logout and protected-route behavior.

## Example summary shape

- **Current auth baseline:** Project uses an existing auth library with session cookies and server-side route protection.
- **Required Google OAuth config:** Register a Google provider in the auth config and wire its callback route into the current auth handler.
- **Required env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, app base URL, and auth/session secret.
- **Server/auth flow:** login button → auth start endpoint → Google consent → callback → code exchange → local session creation.
- **Routes and callbacks:** callback URI must exactly match the route configured in Google Cloud and the app auth handler.
- **Session/user handling:** OAuth identity should map to a local user record and persist via the existing session mechanism.
- **Security requirements:** validate state, use secure cookies, lock down redirect origins, and request minimum scopes.
- **Verification checklist:** test local login, production login, failed callback handling, logout, and protected-route redirects.
- **Gaps or risks:** missing base URL config, unverified callback URI, or unclear user-linking rules.
