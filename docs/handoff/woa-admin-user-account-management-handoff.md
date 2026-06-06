# woa-admin User and Account Management Handoff

## Purpose

This handoff summarizes the current World of Aletheia user/account model and the boundary with the associated administrative site, `woa-admin`, that manages global users, campaign memberships, campaign roles, administrator-required resets, and account/user deletion workflows.

The admin site should be a separate privileged surface, not an extension of the public World of Aletheia UI. This matches ADR-0021: privileged dashboards and operator workflows belong outside the public Astro site unless a new ADR changes that boundary.

## Current baseline

- Public site: Astro on Cloudflare, using Better Auth.
- Runtime database: Cloudflare D1 binding named `DB`.
- Production D1: `world-of-aletheia`.
- Staging D1: `world-of-aletheia-staging`.
- Auth route on public site: `/api/auth/[...all]`.
- User-facing auth pages: `/login`, `/account`, `/logout`, `/forgot-password`, `/reset-password`.
- User self-service account actions remain in this repo and should use Better Auth by default.
- Runtime env access: `cloudflare:workers`; do not rely on `Astro.locals.cfContext`.
- Real identities and campaign assignments live in D1/private operator state, not in tracked repo content.

## Source-of-truth tables

### Better Auth tables

| Table | Purpose | Notes |
|---|---|---|
| `user` | Human identity record | `id` is the stable Better Auth user id. `email_canonical` is the identity lookup field. |
| `account` | Auth provider credentials/links | `providerId = 'credential'` for email/password; `providerId = 'google'` for Google. Password hashes live here for credential accounts. |
| `session` | Active sessions | Delete rows by `userId` to revoke sessions. |
| `verification` | Verification/reset/rate-limit tokens | May contain password-reset token hashes; do not expose values in admin UI/logs. |

### Campaign access table

| Table | Purpose | Notes |
|---|---|---|
| `campaign_memberships` | Campaign entitlement authority | Unique `(user_id, campaign_slug)`. `role` is constrained to `member` or `gm`. `gm` implies member access. |

## Identity policy

- Canonical email policy is `trim(lower(email))`.
- `email_canonical` is unique where non-empty.
- Admin lookup should prefer `user.id` for mutations and `email_canonical` for search/resolution.
- If identity is ambiguous, stop and resolve before mutating campaign access or auth links.
- Never commit real user identifiers, private assignments, reset URLs, token values, full password hashes, salts, derived keys, or pepper values.

## Role model

Current campaign roles:

| Role | Meaning |
|---|---|
| `member` | Can access campaign-member protected campaign content. |
| `gm` | Can access GM-protected content and member content for the same campaign. |

Requirements for `woa-admin`:

- Validate role values server-side against `member | gm` for the current `campaign_memberships.role` field.
- Treat `campaign_slug` as the campaign key.
- Use `campaign_memberships` as the only live GM authority.
- Do not resurrect `campaign_gm_assignments`; ADR-0019 unified roles into `campaign_memberships`.

Near-future campaign administration capability:

- Introduce a campaign-scoped administrative capability named `user-admin`.
- By default, any user with `campaign_memberships.role = 'gm'` for a campaign should have `user-admin` capability for that campaign.
- `user-admin` is a capability, not necessarily the same thing as the current membership role column. The current D1 role constraint only allows `member | gm`, so adding explicit non-GM user administrators will require either a new capability table, a schema expansion, or another documented authorization decision.
- A campaign `user-admin` may manage people only inside the campaigns where they have that capability; they must not receive global user/account search privileges.
- Global `woa-admin` operators can manage users/accounts across the database; campaign `user-admin` actors are restricted to campaign membership workflows.

## Required admin capabilities

### User/account discovery

- Search users by canonical email, display name, and user id.
- Show linked auth accounts per user: provider, provider account id, created/updated timestamps.
- Show active session count and recent session metadata without exposing session tokens.
- Show campaign memberships and roles for a selected user.
- Show campaign member list and GMs for a selected campaign.

### Campaign membership management

- Add user to campaign with role `member` or `gm`.
- Change existing role between `member` and `gm`.
- Remove user from campaign.
- Bulk list members by campaign and campaigns by user.
- Verify postcondition after every mutation.
- Support campaign-scoped membership management from this repo's future campaign admin dashboard, using the same API contracts as external `woa-admin` where practical.

Expected write semantics:

- Grant/upsert membership:
  - Insert `(user_id, campaign_slug, role)`.
  - On existing row, update `role` and `updated_at`.
- Role update:
  - Update only an existing row.
  - Return affected-row count; zero rows means no membership existed.
- Revoke:
  - Delete exactly the targeted `(user_id, campaign_slug)` row.

### Password reset and credential recovery

User self-service path:

- Keep self-service `/forgot-password`, `/reset-password`, and signed-in change password in the public site.
- These flows should use Better Auth native APIs (`requestPasswordReset`, `resetPassword`, `changePassword`, and future `setPassword`) rather than direct D1 mutation code.
- The public site may send Mailjet reset links through Better Auth's `sendResetPassword` callback.

Admin path:

- Provide administrator-required reset and recovery workflows in `woa-admin`, not through public-site operator scripts.
- Preserve the existing Better Auth `user.id` so campaign memberships remain valid.
- Require `PASSWORD_HASH_PEPPER` in the privileged runtime/worker secret context.
- Generate ADR-0023 hashes with prefix `woa-pbkdf2-sha256-v1`.
- Never display or log passwords, full hashes, salts, derived keys, pepper values, raw reset tokens, or reset URLs.
- Offer session revocation after reset; default should be revoke all sessions for the user.

Credential creation/recreation:

- If a user has no `providerId = 'credential'` row, creating one should be an explicit admin action, not an accidental side effect.
- Google-only users should remain Google-only unless the admin intentionally creates a credential account.

### Provider account linking

- Display provider links from `account`.
- Corrective linking/relinking is allowed only for verified operator cases.
- Precondition checks should confirm exactly one target user and exactly one intended provider identity.
- Revoking a provider link should not delete the `user` row or campaign memberships by default.

### Session management

- List active sessions by `userId` using safe metadata only.
- Revoke all sessions for a user.
- Optionally revoke individual sessions by session id.
- After password reset, default to revoking all sessions.

### Campaign admin front-end for this repo

The public World of Aletheia repo may include campaign-scoped management UI, but it should be front-end/page development plus calls to `woa-admin` APIs defined in `docs/contracts/user-account-management-api.openapi.yaml`. It should not write directly to D1 and should not expose global account-management dashboards inside this repo.

Minimum capabilities:

- Show a campaign member list for the selected campaign.
- Allow a campaign `user-admin` to invite a known email address to join the campaign.
- Allow a campaign `user-admin` to remove a member from that campaign.
- Allow a campaign `user-admin` to change campaign-scoped roles/capabilities up to the limits allowed by policy.
- Deny all campaign-admin actions unless the signed-in actor has `user-admin` capability for that exact `campaign_slug`.

Privacy constraints:

- Campaign `user-admin` actors must not be able to browse, search, or enumerate all users/accounts in D1.
- A campaign admin may act on a known email address they provide, an existing campaign member, or a user who has applied/requested access to that campaign.
- API responses should reveal no more than needed: for invitations, return generic status; for members, return only campaign-relevant identity fields.

Likely onboarding flows:

1. **Invitation-first flow**: campaign admin enters a known email address; system creates an invitation or pending membership record; invited user accepts after authenticating.
2. **Application/request flow**: signed-in user requests access to a campaign; campaign `user-admin` reviews and approves/rejects.
3. **Direct add flow**: only for global admins or explicitly trusted campaign admins, and only when the target identity resolves safely without revealing unrelated accounts.

### Account/user deletion

Deletion needs explicit policy because it can break campaign access, auditability, and account recovery.

Recommended default: disable/deprovision rather than hard-delete until a retention policy exists.

If hard deletion is implemented, it must be a deliberate, multi-step admin flow:

1. Resolve the user by `user.id` and canonical email.
2. Show linked accounts, active sessions, verification rows, and campaign memberships.
3. Require confirmation with environment, user id, and canonical email.
4. Execute in a transaction/batch where possible.
5. Delete dependent rows before the user row:
   - `session` rows for `userId`
   - `verification` rows related to user-specific identifiers where applicable
   - `account` rows for `userId`
   - `campaign_memberships` rows for `user_id`
   - finally the `user` row
6. Record an audit event without storing secrets or unnecessary personal data.

Safer alternatives:

- Revoke all sessions.
- Remove all campaign memberships.
- Revoke credential/provider links.
- Change email/name through a privacy-preserving anonymization flow.

## Core use cases

### UC-01: Add a user to a campaign

Actor: Admin/operator.

Preconditions:

- Admin is authenticated and authorized in `woa-admin`.
- Target user resolves to exactly one `user.id`.
- Campaign slug is known.

Flow:

1. Admin searches by email or user id.
2. Admin selects campaign slug and role.
3. System validates role is `member` or `gm`.
4. System upserts `campaign_memberships`.
5. System shows postcondition: row exists with expected role.

### UC-02: Change campaign role

Actor: Admin/operator.

Flow:

1. Admin opens user or campaign membership view.
2. Admin changes role from `member` to `gm` or from `gm` to `member`.
3. System updates only the existing row.
4. System reports affected-row count and refreshed access state.

### UC-03: Remove user from a campaign

Actor: Admin/operator.

Flow:

1. Admin selects membership row.
2. System confirms campaign slug, user id, and current role.
3. Admin confirms revoke.
4. System deletes the exact row.
5. System verifies the user no longer appears in that campaign membership list.

### UC-04: Reset a password

Actor: Admin/operator or user.

Normal user flow:

1. User requests reset at `/forgot-password`.
2. User receives reset link by email if eligible.
3. User sets new password at `/reset-password`.

Admin fallback flow:

1. Admin resolves user identity.
2. System confirms credential row state.
3. Admin sets or generates a temporary password through a secret-safe UI.
4. System writes an ADR-0023 hash to the existing credential row.
5. System revokes sessions.
6. System verifies hash prefix and campaign memberships remain attached to the same user id.

### UC-05: Link or unlink provider account

Actor: Admin/operator.

Flow:

1. Admin resolves the target user.
2. Admin reviews existing `account` provider rows.
3. Admin performs explicit corrective link or unlink.
4. System verifies resulting provider links.
5. System optionally revokes sessions if the correction changes sign-in risk.

### UC-06: Campaign admin invites a known email

Actor: Campaign `user-admin`.

Preconditions:

- Actor has `user-admin` capability for the campaign.
- Actor knows the invitee email address outside the system.

Flow:

1. Campaign admin opens the campaign admin dashboard.
2. Campaign admin enters an email address and requested role/capability.
3. System normalizes the email and creates an invitation without exposing whether the email already belongs to an account unless policy explicitly permits.
4. System sends or queues invitation delivery.
5. Invitee signs in or signs up and accepts.
6. System creates or updates the campaign membership after acceptance.

### UC-07: User applies to join a campaign

Actor: Signed-in user; campaign `user-admin`.

Flow:

1. User requests access to a campaign from a campaign-facing UX.
2. System records a pending request scoped to `campaign_slug` and `user.id`.
3. Campaign `user-admin` sees pending requests only for campaigns they administer.
4. Campaign `user-admin` approves or rejects.
5. On approval, system creates campaign membership with an allowed default role, normally `member`.

### UC-08: Campaign admin removes or changes a campaign member

Actor: Campaign `user-admin`.

Flow:

1. Campaign admin opens member list for one campaign.
2. System verifies actor has `user-admin` capability for that exact campaign.
3. Campaign admin removes a member or changes an allowed role/capability.
4. System prevents privilege escalation beyond actor's allowed scope.
5. System records an audit event with actor id, target user id, campaign slug, and before/after state.

### UC-09: Delete or deprovision a user

Actor: Admin/operator.

Flow:

1. Admin resolves target user.
2. System presents impact summary: accounts, sessions, campaign memberships, verification rows.
3. Admin chooses deprovision/anonymize or hard delete.
4. System requires typed confirmation for destructive actions.
5. System performs ordered cleanup and records an audit event.
6. System verifies no active sessions or memberships remain for that user id.

## Non-functional requirements

### Security

- `woa-admin` must have stronger access control than the public site.
- Require least-privilege admin roles for account viewing, membership editing, password reset, and destructive deletion.
- Use server-side authorization for every mutation.
- Use CSRF-safe form/API patterns.
- Rate-limit sensitive actions, especially password reset and session revocation.
- Never expose reset tokens, session tokens, full hashes, salts, derived keys, pepper values, or OAuth tokens.
- Mark admin pages and responses `noindex,nofollow`, but treat crawler controls as non-security.

### Auditability

Every admin mutation should record:

- actor admin id
- target user id
- operation type
- target campaign slug where applicable
- before/after role where applicable
- environment (`local`, `staging`, `prod`)
- timestamp
- request/correlation id

Audit logs must not include secrets, raw tokens, passwords, full hashes, OAuth tokens, or unnecessary personal data.

### Deploy safety

- Validate in staging before production.
- Prefer read-only preview/impact summaries before writes.
- For destructive or broad actions, require typed confirmation and exact target identifiers.
- Avoid broad updates/deletes without `userId`, `campaign_slug`, or explicit date/identifier filters.
- Use transactions/batches for multi-table account deletion and reset completion.

### Data model boundaries

- Admin state should not be stored in Obsidian content or public repo files.
- Public content canon remains static and Obsidian-first.
- Operational identity state belongs in D1/private admin infrastructure.
- If `woa-admin` introduces new admin audit tables or admin roles, define them in a separate migration/ADR rather than overloading content collections.
- Keep campaign-admin APIs loosely coupled from page components so the dashboard can move to `woa-admin` or another service later.
- Prefer explicit request/response contracts over importing public-site internals into external admin code.

## Suggested admin screens

1. **User search**: email/user id search, canonical email display, linked accounts, session count.
2. **User detail**: identity, provider accounts, campaign memberships, password/session actions.
3. **Campaign access**: campaign slug, member list, GM list, add/update/revoke controls.
4. **Password recovery**: self-service status, admin reset fallback, credential creation warning.
5. **Destructive actions**: deprovision/anonymize/delete wizard with impact summary.
6. **Audit log**: filter by actor, target user, campaign slug, operation, environment, date.

## API/operation contract sketch

Global account-administration APIs and campaign membership mutation APIs belong to `woa-admin`. This repo should consume those APIs from campaign-facing UI instead of implementing direct mutation endpoints or D1 operator workflows.

Global admin operations expected for `woa-admin`:

- `GET /users?email=...`
- `GET /users/:userId`
- `GET /users/:userId/campaign-memberships`
- `PUT /users/:userId/campaign-memberships/:campaignSlug` with `{ role }`
- `DELETE /users/:userId/campaign-memberships/:campaignSlug`
- `POST /users/:userId/password-reset`
- `POST /users/:userId/sessions/revoke`
- `PUT /users/:userId/accounts/:providerId/:providerAccountId`
- `DELETE /users/:userId/accounts/:providerId/:providerAccountId`
- `POST /users/:userId/deprovision`
- `DELETE /users/:userId` only if hard-delete policy is approved

External-facing campaign-scoped APIs required by the in-repo campaign admin dashboard:

- `GET /campaigns/:campaignSlug/members`
  - Auth: campaign `user-admin` or global admin.
  - Returns only campaign-relevant member fields; no provider/session/password data.
- `PUT /campaigns/:campaignSlug/members/:userId` with `{ role }`
  - Auth: campaign `user-admin` or global admin.
  - Updates an existing membership role/capability within approved policy.
- `DELETE /campaigns/:campaignSlug/members/:userId`
  - Auth: campaign `user-admin` or global admin.
  - Revokes only the exact campaign membership.
- `POST /campaigns/:campaignSlug/invitations` with `{ email, requestedRole }`
  - Auth: campaign `user-admin` or global admin.
  - Must avoid disclosing whether the email already has an account.
- `GET /campaigns/:campaignSlug/invitations`
  - Auth: campaign `user-admin` or global admin.
- `DELETE /campaigns/:campaignSlug/invitations/:invitationId`
  - Auth: campaign `user-admin` or global admin.
- `POST /campaigns/:campaignSlug/access-requests`
  - Auth: signed-in user.
  - Creates a self-application/request for the current user only.
- `GET /campaigns/:campaignSlug/access-requests`
  - Auth: campaign `user-admin` or global admin.
- `POST /campaigns/:campaignSlug/access-requests/:requestId/approve`
  - Auth: campaign `user-admin` or global admin.
  - Creates membership after approval.
- `POST /campaigns/:campaignSlug/access-requests/:requestId/reject`
  - Auth: campaign `user-admin` or global admin.
- `GET /campaigns/:campaignSlug/admin-capability` or equivalent capability field in dashboard bootstrap response
  - Auth: signed-in user.
  - Reports whether the current actor has campaign `user-admin` capability for that campaign.

OpenAPI requirements for these APIs:

- Define auth requirements per endpoint: global admin, campaign `user-admin`, or signed-in user.
- Define path parameters, request bodies, response bodies, and error responses.
- Mark privacy-preserving responses where user existence must not be disclosed.
- Include examples for invitation, application approval, membership role update, revoke, and capability check.
- Keep schemas transport-oriented and stable; do not expose raw D1 row shapes unless they are intentionally part of the external contract.
- Version or namespace the API contract if `woa-admin` will consume it independently of this repo's page implementation.

## Open decisions for woa-admin

1. Admin identity source: use Better Auth, Cloudflare Access, or another admin-only identity provider?
2. Admin authorization model: single admin role, separate operator roles, campaign-scoped `user-admin`, or per-capability permissions?
3. Audit log storage: D1 table in public-site DB, separate admin DB, or external logging system?
4. User deletion policy: hard delete, deprovision, anonymize, or staged retention?
5. Whether `woa-admin` writes directly to the public site's D1 database or calls a narrowly scoped admin API.
6. Whether password reset fallback should set temporary passwords or send admin-triggered reset emails.
7. Where explicit campaign `user-admin` grants live if non-GM campaign administrators are needed.
8. Whether campaign invitations and access requests share one table/state machine or remain separate workflows.
9. Whether campaign admins may elevate another member to `gm`, or only to a lesser `user-admin`/membership-management capability.

## Existing operational references

- `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`
- `docs/integrations/woa-admin-campaign-user-management-front-end-guide.md`
- `docs/contracts/user-account-management-api.openapi.yaml`
- `plans/adrs/0019-campaign-membership-role-unification.md`
- `plans/adrs/0021-external-admin-capability-boundary.md`
- `plans/adrs/0023-cloudflare-worker-friendly-versioned-password-hashing.md`
