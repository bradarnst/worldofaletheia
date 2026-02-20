# Draft Visibility Follow-up TODO

## Context

Current policy is intentionally temporary: draft entries are visible in public listing pages and are flagged with a status badge.

This was done to unblock content visibility while a dedicated draft-preview workflow does not yet exist.

## TODO

- [ ] Decide long-term policy for draft visibility on public pages
- [ ] Define and implement a dedicated draft preview workflow (private route, auth gate, or preview deployment)
- [ ] If drafts become hidden again, update [`shouldIncludeContent()`](src/utils/content-filter.ts:8) to enforce environment-based exclusion
- [ ] If drafts remain visible, define UX copy and badge style guidance for all list/detail templates
- [ ] Document the final policy in project docs and ADRs if scope is architectural
