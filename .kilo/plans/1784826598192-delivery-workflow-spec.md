Status: ready-for-agent
Labels: ready-for-agent

# Spec: Delivery Workflow Documentation

## Problem Statement

The project owner currently works directly on `main` and has strong spec-driven development habits, but the codebase has grown large enough that direct-to-main work creates avoidable risk. The current workflow does not consistently create a reviewable boundary around meaningful changes, does not provide a clear accountability boundary for AI-assisted implementation, and does not give future collaborators an explicit path for branches, pull requests, review, verification, and merge authority.

At the same time, the project owner does not want process rigor to become ceremony for its own sake. The workflow must preserve solo-development velocity, support many small fast changes, and remain portable across this public GitHub repository, private repositories with fewer free-plan controls, and possible future GitLab or other hosting options. Deployment automation should benefit from the workflow later, but deploy design is not part of this spec.

## Solution

Document a lightweight Delivery Workflow for World of Aletheia that is policy-first and automation-assisted. The workflow makes meaningful work reviewable, recoverable, and understandable without depending on paid platform features or immediate CI/deploy automation.

The solution introduces a contributor-facing workflow guide and a short pull request template. The guide defines when work needs a branch and pull request, how planned tickets and just-in-time fixes flow through branches, what every pull request must prove before merge, how risk-based verification works, how AI agents and human collaborators are accountable, how ticket dependencies sequence work, and how commits are shaped on working branches versus `main`.

The initial rollout is documentation-only. It does not add CI, branch protection, deployment gates, stacked pull request tooling, or an ADR. A follow-up ticket should add minimal pull request CI after the workflow is documented.

## User Stories

1. As Brad, I want a documented Delivery Workflow, so that I can add rigor without relying on memory or ad hoc judgment.
2. As Brad, I want meaningful work to happen on branches before edits begin, so that I do not accidentally turn direct-to-main work into production-relevant changes.
3. As Brad, I want planned work to start from a ticket or spec, so that every branch has a clear intent.
4. As Brad, I want unplanned quick fixes to allow a just-in-time pull request reason, so that the workflow does not slow down obvious focused repairs.
5. As Brad, I want exploratory work to live on disposable scratch branches, so that learning work cannot merge accidentally.
6. As Brad, I want one implementation ticket to usually map to one branch and one pull request, so that review units stay small.
7. As Brad, I want many small fast pull requests to be normal, so that rigor does not imply large heavyweight reviews.
8. As Brad, I want tightly related tiny tickets to be allowed in one pull request when coherent, so that the workflow remains practical.
9. As Brad, I want unrelated cleanup excluded from feature pull requests, so that review scope stays clear.
10. As Brad, I want branch names to follow familiar Git conventions, so that agents and collaborators can understand branch purpose quickly.
11. As Brad, I want ticket-linked branch names for planned work, so that branches can be traced back to their source of intent.
12. As Brad, I want quick-fix branch names for unplanned repairs, so that small fixes do not require a ticket before work can begin.
13. As Brad, I want scratch branch names for exploration, so that experimental work is visibly non-mergeable.
14. As Brad, I want every pull request to include a linked ticket or reason, so that future readers know why the change exists.
15. As Brad, I want every pull request to explain what changed and why, so that review does not require reconstructing intent from the diff.
16. As Brad, I want every pull request to record verification, so that merge confidence is based on evidence rather than memory.
17. As Brad, I want skipped verification to require a reason, so that omissions are explicit and reviewable.
18. As Brad, I want every pull request to include risk notes, so that auth, data, schema, content sync, deployment, and user-visible risks are surfaced early.
19. As Brad, I want a minimal pull request evidence standard, so that the workflow is strict enough for agents and junior collaborators.
20. As Brad, I want a tiered verification matrix, so that high-risk changes receive stronger checks without forcing full verification on prose-only edits.
21. As Brad, I want docs-only prose changes to avoid unnecessary command requirements, so that obvious text fixes stay lightweight.
22. As Brad, I want rendered docs, route, frontmatter, and navigation changes to require a build when appropriate, so that documentation/content changes that affect the site are still validated.
23. As Brad, I want runtime, auth, tooling, config, and package changes to require tests and build verification, so that production-relevant behavior is checked before merge.
24. As Brad, I want content schema, frontmatter, and content sync changes to require content validation, so that the Obsidian-first publishing pipeline remains safe.
25. As Brad, I want D1, auth, operator SQL, and migration changes to require relevant dry-run or preflight verification, so that data-affecting work is handled carefully.
26. As Brad, I want low-risk pull requests defined by objective criteria, so that "trivial" does not mean different things to different people or agents.
27. As Brad, I want AI-assisted review required for source, scripts, configs, schemas, migrations, auth, sync, tests, or architecture-governed changes, so that solo work still receives an extra set of eyes.
28. As Brad, I want prose-only docs/content pull requests to be allowed with self-review, so that the workflow does not overburden low-risk changes.
29. As Brad, I want agent-authored work to require explicit Brad acceptance, so that agents remain force multipliers rather than decision makers.
30. As Brad, I want collaborators and external contributors to require Brad review by default, so that architecture and final acceptance remain clear.
31. As a new collaborator, I want the default trust tier documented, so that I know I cannot assume merge authority.
32. As a trusted collaborator, I want the path to limited merge authority documented, so that trust can grow explicitly rather than informally.
33. As an external contributor, I want contribution expectations documented, so that I know how to open a reviewable pull request.
34. As an AI agent, I want clear rules for what I may do, so that I can implement tickets without overstepping authority.
35. As an AI agent, I want clear rules for what I must not do, so that I do not merge, approve myself, broaden scope silently, or make architecture decisions implicitly.
36. As Brad, I want working branches to allow small checkpoint commits, so that I can recover when an agent or human misunderstands design direction.
37. As Brad, I want pull request review history to show incremental correction commits when useful, so that misunderstanding can be caught and corrected before merge.
38. As Brad, I want `main` history to use squash merge by default, so that durable history stays clean and pull-request-sized.
39. As Brad, I want multiple commits preserved only when intentionally curated, so that detailed history is retained only when it adds value.
40. As Brad, I want ticket dependencies to drive sequencing, so that dependent work can stay ordered without adopting stacked pull request tooling immediately.
41. As Brad, I want multi-ticket specs to declare blocking edges, so that agents can pick unblocked work safely.
42. As Brad, I want branches to start from `main` after blockers merge by default, so that dependency handling remains simple.
43. As Brad, I want shallow manual stacks allowed only as an owner-controlled exception, so that I can work ahead without forcing everyone into stacked tooling.
44. As Brad, I want stacked pull request tooling deferred, so that I do not learn and impose new tools before the pain is measurable.
45. As Brad, I want the workflow to be portable across hosting platforms, so that it works for the public repo and later private repos.
46. As Brad, I want platform enforcement treated as optional reinforcement, so that GitHub Free limitations do not block adoption.
47. As Brad, I want CI treated as a follow-up, so that the documentation workflow can land before automation details are solved.
48. As Brad, I want future CI to align with the verification matrix, so that automation enforces the same policy humans already follow.
49. As Brad, I want deployment automation out of scope, so that this workflow decision stays contained.
50. As Brad, I want the workflow to avoid blocking future deployment automation, so that staging and production gates can be added naturally later.
51. As Brad, I want no ADR yet, so that reversible process documentation does not become over-formalized.
52. As Brad, I want an ADR considered only if the workflow later adopts hard-to-reverse enforcement or tooling, so that decision records remain meaningful.
53. As Brad, I want the workflow effective immediately, so that the new discipline starts with the next meaningful change.
54. As Brad, I want a review checkpoint after the first five meaningful pull requests or two weeks, so that friction can be tuned based on real use.
55. As a future maintainer, I want the workflow rationale documented, so that I understand why the project chose lightweight pull-request discipline over direct-to-main work.
56. As a future maintainer, I want the workflow non-goals documented, so that I do not mistake this for a deploy automation or CI project.
57. As a reviewer, I want a short pull request template, so that every review starts with intent, linkage, verification, risk, and reviewer notes.
58. As a reviewer, I want the pull request template to stay short, so that it enforces minimum evidence without becoming checkbox theater.
59. As a spec-driven developer, I want the Delivery Workflow to align with specs and implementation tickets, so that it complements my existing strengths.
60. As Brad, I want follow-up work called out explicitly, so that CI and workflow review do not disappear after documentation lands.

## Implementation Decisions

- The documented concept is the **Delivery Workflow**, not merely a branching workflow or pull request workflow, because it covers issue/spec usage, branches, pull requests, review, verification, AI accountability, collaborators, commits, dependencies, and future automation.
- The Delivery Workflow is policy-first and automation-assisted. Platform controls are useful reinforcement but not foundational requirements.
- Deployment automation is explicitly out of scope. The workflow should remain compatible with future staging and production automation but must not design those gates now.
- A contributor-facing guide is the primary artifact for the workflow because this is day-to-day process guidance, not an application architecture decision.
- A short pull request template is included immediately because it places the minimum evidence standard where contributors and agents need it.
- No ADR is created in the first rollout because the decision remains reversible process policy. An ADR becomes appropriate only if later choices introduce hard-to-reverse platform enforcement, paid tooling, stacked pull request infrastructure, deploy/release gates, or surprising trade-offs future maintainers need to understand.
- Meaningful work is defined as work that changes behavior, contracts, architecture, tooling, or any production-relevant artifact.
- Direct-to-main work is reserved for prose-only docs/content fixes and emergency repairs.
- Planned meaningful work follows ticket/spec, branch, work, pull request.
- Unplanned quick fixes may start with a branch and use the pull request itself to record the just-in-time reason.
- Exploratory work uses scratch branches and cannot merge directly. It must become a focused ticket/spec-backed pull request or a focused just-in-time quick-fix pull request before merge.
- The default unit is one implementation ticket, one branch, one pull request.
- Multiple tiny, tightly related tickets may share one pull request only when reviewable as one coherent change.
- Unrelated fixes, broad cleanup, and long-lived feature branches are not allowed as the default shape.
- Branch naming uses conventional slash-prefixed categories for ticket work, fixes, docs, chores, scratch exploration, and hotfixes.
- Branch names use lowercase kebab-case after the category and describe the change goal rather than the implementation mechanism.
- Every pull request must include a linked ticket/spec or one-sentence reason, intent, verification, and risk notes.
- Pull requests may not merge with blank verification notes. `Not run` is allowed only with a reason.
- The Initial Verification Matrix is tiered by change type rather than one-size-fits-all.
- Prose-only docs/content changes require no command by default, but rendered Markdown, routes, frontmatter, or navigation changes require a build when affected.
- Runtime, auth, tooling, config, and package changes require project tests and build verification.
- Content schema, frontmatter, and content sync changes require project tests, build verification, and content sync validation.
- D1, auth, operator SQL, and migration changes require project tests, build verification, and the relevant dry-run or preflight command for the affected scope.
- Low-risk pull requests are defined objectively as prose-only docs/content changes with no source code, schema, frontmatter, package/config/tooling, generated runtime/build output, auth, data, API, or content sync behavior.
- AI-assisted review is required before solo merge for source, scripts, package/lockfile state, framework/config files, schemas/frontmatter, migrations/operator SQL, auth/session/membership behavior, sync/import/export behavior, routes/rendering/components/layouts, tests, or ADR-governed conventions.
- Brad review and acceptance is required before merge for work authored by agents, collaborators, or external contributors.
- AI review can assist but never replaces Brad’s acceptance for agent, collaborator, or external pull requests.
- Agents may work from a ticket/spec, create or use a branch, make focused commits, run verification, summarize intent/verification/risk, and request review.
- Agents must not merge to `main`, approve their own work, silently broaden scope, make architecture/auth/data-contract decisions without surfacing them, or treat passing tests as final acceptance.
- Human collaborators use trust tiers. Everyone starts as a new collaborator unless Brad explicitly grants another role.
- External contributors and new collaborators have no merge authority and require Brad review.
- Trusted collaborators or maintainers are explicitly granted, never assumed, and must still use the pull request checklist and escalate auth, data, schema, architecture, or tooling changes to Brad.
- Working branches may use small coherent checkpoint commits for recovery and review, especially when a ticket proves less simple than expected.
- Pull request review may show incremental correction commits while the work is under review.
- `main` uses squash merge by default, with the pull request as the review unit and the squashed commit as the durable history unit.
- Multiple commits are preserved only when intentionally curated and independently meaningful.
- Ticket dependencies are the source of truth for sequencing. Multi-ticket work declares blocking edges before implementation.
- Branches normally start from `main` after blockers merge. Shallow manual stacks are an owner-only exception for clearly dependent tickets.
- Stacked pull request tooling, `git-branchless`, Graphite-like workflows, branch protection, CI, and deploy automation are all deferred.
- Minimal pull request CI is a follow-up after the workflow documentation lands.
- The workflow is effective immediately for meaningful work and should be reviewed after the first five meaningful pull requests or two weeks of active use.

## Testing Decisions

- This is documentation/process work, so the highest-value test seam is the published contributor-facing workflow itself: reviewers should verify that a contributor or agent can read the guide and know exactly when to branch, when to use a ticket/spec, what to put in a pull request, what verification to run, and who may merge.
- The second seam is the pull request template: reviewers should verify that it captures the absolute minimum evidence standard without adding unnecessary checklist weight.
- Good tests for this work are document-review checks against externally visible behavior, not implementation details. The behavior under test is whether the documented workflow is complete, unambiguous, and usable by Brad, agents, external contributors, new collaborators, and trusted collaborators.
- The documentation should be checked for consistency with the resolved decisions from the grilling session: policy-first enforcement, no deploy design, no immediate CI, no ADR, no stacked tooling, branch-before-meaningful-work, ticket/spec-first for planned work, just-in-time PR reason for quick fixes, and Brad final acceptance.
- The documentation should be checked for consistency with the project’s existing public posture that Brad owns architecture, technical direction, review, and final acceptance, and that agents are force multipliers rather than autonomous decision makers.
- The documentation should be checked for consistency with the project’s pnpm-only rule. No implementation step should introduce package manager or dependency changes.
- The documentation should be checked for enough specificity that agents and junior or unknown collaborators do not have to interpret vague terms like "trivial" or "non-trivial".
- The documentation should be checked for portability: it should not assume paid GitHub features, protected environments, merge queues, or host-specific branch protection features as prerequisites.
- The pull request template should be checked to ensure it includes summary, linked ticket/spec or reason, verification, risk notes, and reviewer notes.
- No automated project test command is required for the documentation-only change unless the contributor guide is rendered by the site or otherwise affects build output.
- If the documentation is later made part of the rendered site or site navigation, a build should be run under the verification matrix.
- Prior art for publication is the repo’s local Markdown issue convention under the scratch issue tracker, where specs carry `Status: ready-for-agent` and `Labels: ready-for-agent` at the top.

## Out of Scope

- Adding GitHub Actions or any other CI automation in the initial implementation.
- Enabling branch protection, required checks, merge queues, protected environments, or other platform enforcement.
- Designing staging deployment, production deployment, environment promotion, or release train rules.
- Adding deploy automation.
- Adding stacked pull request tooling, `git-branchless`, Graphite, or similar workflows.
- Requiring human review for every solo-authored pull request.
- Allowing agents to merge or approve their own work.
- Changing source code, runtime behavior, schemas, database migrations, content sync logic, or package dependencies.
- Creating an ADR for the initial workflow documentation.
- Resolving package-manager hygiene for the existing lockfile warning.
- Migrating the workflow to private repositories or GitLab as part of this implementation.
- Creating detailed tickets for every future workflow improvement beyond the immediate follow-up notes.

## Further Notes

The issue tracker setup files for the Matt Pocock skills were not present under the expected docs area, but an existing local Markdown spec convention exists under `.scratch/`. This spec is therefore published using the local Markdown issue convention with `Status: ready-for-agent` and `Labels: ready-for-agent`.

A previous grilling pass saved an implementation-ready planning note under the local Kilo plans area. This spec is the repo-facing PRD-style artifact that should drive implementation of the actual workflow documentation.

Recommended first implementation branch: `docs/delivery-workflow`.

Recommended follow-up tickets after the documentation lands:

1. Add minimal pull request CI that uses pnpm and runs the project test and build commands without deployment automation.
2. Review the Delivery Workflow after the first five meaningful pull requests or two weeks of active use.
3. Investigate the existing package-lock warning under the local Kilo configuration area without making package manager changes as part of this spec.
