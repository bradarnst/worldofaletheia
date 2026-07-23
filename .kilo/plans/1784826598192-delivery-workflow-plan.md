# Delivery Workflow Documentation Plan

## Status

Implementation-ready plan, produced from the workflow grilling session on 2026-07-23.

## Important repository note

A `package-lock.json` exists under `.kilo/`. Project rules require `pnpm` only and require warning the user if a `package-lock.json` is seen. This plan does not propose changing package manager state; it records the warning as a follow-up hygiene item.

## Goal

Document and begin using a lightweight, portable Delivery Workflow for World of Aletheia that makes meaningful work reviewable, recoverable, and understandable while preserving solo-development velocity.

Deployment automation is intentionally out of scope for this first workflow decision. The workflow should remain compatible with future staging/production automation, but it should not design deploy gates now.

## Resolved decisions

### 1. Scope

In scope:

- issue/spec/ticket usage
- branch policy
- PR policy
- review policy
- local/manual verification expectations
- AI-agent accountability boundary
- collaborator trust tiers
- commit and merge history shape
- follow-up automation path

Out of scope for now:

- staging deployment design
- production deployment automation
- environment promotion rules
- release trains

### 2. Governing approach

Use a **policy-first, automation-assisted** workflow.

The workflow must be portable across:

- this public GitHub repo
- private GitHub repos with fewer free-plan controls
- potential future GitLab or other hosted Git platforms
- local/manual workflows when platform enforcement is unavailable

Do not depend on paid GitHub features, merge queues, protected environments, or advanced rulesets as foundational requirements.

### 3. Unit of work

Default:

```text
one implementation ticket = one branch = one PR
```

Many PRs are expected to be small and fast.

Allowed exception:

```text
Multiple tiny, tightly-related tickets may share one PR only when they are reviewable as a single coherent change.
```

Not allowed:

- unrelated fixes bundled into a feature PR
- broad cleanup branches mixed with feature work
- long-lived feature branches collecting many unrelated tickets

### 4. Meaningful work threshold

A change requires the Delivery Workflow when it changes behavior, contracts, architecture, tooling, or any production-relevant artifact.

Direct-to-main is reserved for:

- prose-only docs/content fixes
- emergency repairs

### 5. Branch timing and ticket/spec linkage

Planned meaningful work:

```text
ticket/spec → branch → work → PR
```

Unplanned quick fix:

```text
branch → work → PR with just-in-time reason
```

Exploratory work:

```text
scratch/* branch → learning only
```

Before merge, exploratory work must become either:

- a focused ticket/spec-backed PR, or
- a focused just-in-time quick-fix PR with a clear reason

Not allowed:

```text
meaningful edits directly on main → retroactively branch later
```

### 6. Branch naming

Use conventional slash-prefixed branch names:

```text
ticket/<id-or-short-key>-<kebab-summary>
fix/<kebab-summary>
docs/<kebab-summary>
chore/<kebab-summary>
scratch/<kebab-summary>
hotfix/<kebab-summary>
```

Rules:

- lowercase kebab-case after the prefix
- include ticket id/key when one exists
- describe the change goal, not the implementation mechanism
- `scratch/*` branches are disposable and cannot merge directly

Examples:

```text
ticket/42-campaign-member-empty-state
fix/calendar-weekday-rollover
docs/delivery-workflow
chore/update-wrangler-config
scratch/campaign-dashboard-layout
hotfix/auth-callback-repair
```

### 7. PR evidence standard

Every PR must include an absolute minimum evidence set:

1. linked ticket/spec, or a one-sentence reason if no ticket exists
2. intent: what changed and why
3. verification: commands run, manual checks performed, or `not run` with reason
4. risk notes, especially for auth, data, content schema, deployment, or user-visible behavior

No PR may merge unless:

- the diff is coherent and scoped
- verification is explicitly recorded
- skipped verification is justified
- production/setup implications are called out

### 8. Initial Verification Matrix

Every PR:

- complete the PR template
- record verification performed
- if verification was not run, explain why

Docs/prose-only:

- no command required by default
- run `pnpm build` if rendering, routes, frontmatter, or navigation are affected

Source/runtime/auth/tooling/config/package changes:

- `pnpm test`
- `pnpm build`

Content schema/frontmatter/content sync:

- `pnpm test`
- `pnpm build`
- `pnpm content:sync:validate`

D1/auth/operator SQL/migrations:

- `pnpm test`
- `pnpm build`
- relevant dry-run/preflight command, depending on scope

Tooling/config/package changes:

- `pnpm test`
- `pnpm build`

### 9. Review and approval policy

Use objective risk triggers rather than ambiguous labels such as "trivial" or "non-trivial".

A PR is low-risk only if all are true:

- docs/content prose only
- no frontmatter/schema changes
- no source code changes
- no package/config/tooling changes
- no generated files that affect runtime/build output
- no auth/data/API/content-sync behavior

AI-assisted review is required before solo merge if a PR changes any of:

- `src/**`
- `scripts/**`
- `package.json` or lockfile state
- Astro, Tailwind, Wrangler, TypeScript, Vitest, or similar config
- content schemas or frontmatter shape
- D1 migrations or operator SQL
- auth/session/campaign membership behavior
- content sync/import/export behavior
- route behavior, page rendering, components, layouts
- tests or test infrastructure
- ADR-governed architecture/conventions

Brad review/acceptance is required before merge for work authored by:

- agents
- collaborators
- external contributors

AI review may assist, but it never replaces Brad’s acceptance for agent/collaborator/external PRs.

### 10. Commit and merge policy

Target shape:

```text
1 ticket → 1 branch → 1 small PR → 1 review unit → 1 squashed main commit
```

Working branch:

- small coherent checkpoint commits are encouraged when useful for rollback or review
- checkpoint commits are especially useful when a ticket proves more complex than expected

PR review:

- incremental correction commits are allowed and visible
- do not hide architecture misunderstandings while the PR is under review

Main:

- squash merge by default
- PR title should be suitable as the final commit subject
- PR body carries context, verification, and risk notes

Exception:

- preserve multiple commits only when they are intentionally curated and independently meaningful

### 11. Ticket dependencies and sequencing

Ticket dependencies are the source of truth for sequencing.

Multi-ticket work should declare blocking edges before implementation begins:

- `Blocked by`: tickets that must land first
- `Blocks`: tickets that depend on this one

Default implementation flow:

```text
choose unblocked ticket
branch from main
implement focused PR
merge blockers-first
then start dependent tickets
```

Allowed exception:

- Brad may use a shallow manual stack for 2–3 clearly dependent tickets

Not default:

- stacked PR tooling
- agent/collaborator-created stacks without explicit instruction

Tooling trigger:

- consider stacked PR tooling only after repeated dependency chains cause measurable delay or rebase pain

### 12. AI-agent accountability boundary

Agents may:

- work from a ticket/spec
- create or use a ticket branch
- make focused commits
- run relevant verification
- summarize intent, verification, and risks
- request review

Agents must not:

- merge to main
- approve their own work
- silently broaden ticket scope
- make architecture/auth/data-contract decisions without surfacing them
- treat passing tests as final acceptance

Brad:

- owns final acceptance
- owns architecture direction
- owns merge authority

### 13. Human collaborator trust tiers

Everyone starts as a **new collaborator** by default unless Brad explicitly approves a different role.

External contributor:

- may open PRs
- Brad review required
- no merge authority

New collaborator:

- default role for all collaborators unless explicitly approved otherwise
- works from ticket/spec
- PR required for meaningful work
- Brad review required
- no direct-to-main
- no merge authority

Trusted collaborator / maintainer:

- explicitly granted, never assumed
- may merge approved low-risk PRs only if granted
- must still use PR checklist
- must escalate auth/data/schema/architecture/tooling changes to Brad

Brad:

- final authority for architecture, auth boundaries, data contracts, ADR-governed decisions, and final acceptance

### 14. Documentation strategy

Create `CONTRIBUTING.md` as the primary Delivery Workflow document.

Do not create an ADR yet.

Revisit an ADR only if the workflow later adopts hard-to-reverse platform enforcement, paid tooling, stacked PR infrastructure, deploy/release gates, or a surprising process trade-off that future maintainers need to understand.

### 15. PR template strategy

Create `.github/pull_request_template.md` with a short minimum-evidence checklist:

```md
## Summary

## Linked ticket/spec

## Verification

## Risk notes

## Reviewer notes
```

Keep the template short. It should enforce the absolute minimum evidence standard, not become a giant checklist.

### 16. CI automation path

Do not block initial rollout on CI.

Document the workflow now, then create an explicit follow-up ticket to add minimal PR CI.

Initial CI target later:

- install with pnpm
- `pnpm test`
- `pnpm build`

CI should eventually enforce parts of the verification matrix where practical, but the policy must remain valid even when platform enforcement is unavailable.

### 17. Adoption model

Adopt the workflow immediately for meaningful work in this repo.

Review checkpoint:

```text
After the first 5 meaningful PRs, or after 2 weeks of active use, Brad should review friction points and update CONTRIBUTING.md if needed.
```

## Files to create in implementation

### `CONTRIBUTING.md`

Create a contributor-facing workflow document containing:

1. Delivery Workflow goals
2. scope and non-goals
3. what requires branch + PR
4. ticket/spec linkage rules
5. branch naming convention
6. PR minimum evidence standard
7. Initial Verification Matrix
8. review and approval policy
9. AI-agent accountability boundary
10. collaborator trust tiers
11. commit/merge policy
12. ticket dependency sequencing
13. immediate adoption and review checkpoint
14. future automation notes

### `.github/pull_request_template.md`

Create a short PR template:

```md
## Summary

<!-- What changed and why? -->

## Linked ticket/spec

<!-- Link the ticket/spec, or explain the just-in-time reason if no ticket exists. -->

## Verification

<!-- Commands run, manual checks performed, or "Not run" with reason. -->

## Risk notes

<!-- Auth, data, schema, content sync, deployment, user-visible behavior, or "None known". -->

## Reviewer notes

<!-- Anything reviewers should focus on. -->
```

## Follow-up tickets to create after documentation lands

1. **Add minimal PR CI**
   - trigger on pull requests
   - use pnpm
   - run `pnpm test`
   - run `pnpm build`
   - keep deployment out of scope

2. **Review workflow after first 5 meaningful PRs or 2 weeks**
   - identify friction
   - tighten/loosen verification matrix as needed
   - decide whether branch protection or CI required checks are worth enabling where free-plan features permit

3. **Investigate `.kilo/package-lock.json` package-manager hygiene**
   - project rule is pnpm-only
   - determine whether this file is intentional inside `.kilo/` or should be removed/regenerated through the correct tooling

## Implementation order

1. Create `CONTRIBUTING.md`.
2. Create `.github/` if it does not exist.
3. Create `.github/pull_request_template.md`.
4. Optionally create local follow-up issue files if a tracker convention is available; otherwise record follow-ups in the final implementation summary.
5. Run no package-manager commands unless needed; this is docs/process-only work.
6. Verify by reading the rendered Markdown or reviewing the diff.

## Non-goals for implementation

Do not implement:

- GitHub Actions CI in the initial documentation PR
- branch protection settings
- deployment automation
- stacked PR tooling
- `git-branchless`, Graphite, or similar tooling
- ADR creation
- package/dependency changes
