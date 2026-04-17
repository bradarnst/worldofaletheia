# Potential Todos 2026-03-12 

> Historical note (2026-04-17): Option 3 unified membership roles has since been implemented, rolled out, and closed. References below are preserved as planning context from before that completion.

## Pressing (worth deciding now)
- Settle the authz data-model direction before more campaign features: either keep the current dual-table model (campaign_memberships + campaign_gm_assignments) or move to Option 3 unified roles. Option 3 is already queued as the next structural refactor in plans/option-3-unified-membership-role-upgrade-todo.md:1.
- Status-doc consistency cleanup: plans/auth-mvp-production-readiness-plan-2026-03.md:38 still has “Outstanding/active implementation focus” items that appear already completed in practice, so this is now drift risk between reality and docs.
- Lock draft-visibility policy: unresolved policy still sits in plans/draft-visibility-follow-up-todo.md:15; this affects publishing behavior and user expectations.

## Good optional next steps
- Option 2 hardening leftovers (if not fully done): add/confirm the multi-GM test coverage and operator verification snippets from plans/auth-option-2-d1-gm-authoritative-lld-handoff-2026-03-12.md:178.
- Navigation trust pass: resolve “implement/hide/label upcoming” for incomplete links from plans/frontend-ui-ux-hardening-phase-plan-2026-q1.md:112.
- Calendar phase planning: if calendar is near-term, its doc marks required phased work and “must/should” buckets in plans/features/aletheia-calendar-architecture-recommendation.md:441.

## If your “important refactor” is Option 3 (unified roles), comparison
- Value: removes split authority and simplifies mental model/operator workflow long-term.
- Cost/Risk: medium-to-high; needs migration/backfill, resolver switch, template/runbook rewrites, burn-in, then table decommission (plans/option-3-unified-membership-role-upgrade-todo.md:24).
- Timing advice: best done before adding more campaign auth features, but after you snapshot and clean current “implemented” status docs so rollback reasoning is crisp.

## Recommended order
1. Update stale phase-status docs (fast, low risk).
2. Make the go/no-go decision on Option 3 refactor.
3. If go: execute Option 3 as a single tracked program (ADR → migration window → read-path switch → decommission).  
4. If no-go: run only hardening + UX/navigation + draft-policy closure.
