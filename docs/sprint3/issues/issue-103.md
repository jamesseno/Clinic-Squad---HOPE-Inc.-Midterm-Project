# S3-SM-05: Sprint 3 review and retrospective report

Issue: #103
Owner: `jamesseno`
Target: Sprint 3, day 10

## Review status

The official Sprint 3 scope is 30 issues (#74–#103). At the current review snapshot, all 30 remain open. No Sprint 3 issue is represented here as merged. PR #191 (HR) and #192 (Sales) are closed and unmerged and must not be counted as delivery.

## Exit checklist

- [ ] Department, Job, Employee, Job History/profile, and separation flows verified with non-production data.
- [ ] Create/edit/delete/restore actions pass per-right checks, including direct API requests.
- [ ] Salary and Job History fields are not returned to users lacking the required right.
- [ ] Effective-date uniqueness and child-record delete rules pass PostgreSQL tests.
- [ ] Sprint 1/2 Customer, Product, Price History, auth, and rights regression is recorded.
- [ ] All 30 issues reconcile to issue-specific PRs, original assignees, teammate reviews, CI, and merge state.
- [ ] Demo evidence and retrospective actions are recorded from the actual team review.

## Sprint 4 entry gate

**Current decision: blocked.** The HR/Sales PRs #191 and #192 are closed without merging; hosted Supabase migration/RLS behavior has not been verified in this workspace; and the Sprint 3 task PR/review count is not reconciled. The gate can be reconsidered only after merged implementation, authorized database tests, and regression evidence are attached.

## Retrospective items to capture

| Topic | Evidence to bring to review | Action owner |
|---|---|---|
| PR-per-issue traceability | GitHub issue/PR links, assignees, reviewers, and merge state | Scrum Master |
| Database and access-control reliability | Migration run, RLS tests, direct-request tests, and failures | DB Admin + Tester |
| Team handoffs | UI/UX and test artifacts linked to implementation PRs | UI/UX + Developer + Tester |
| Planning accuracy | Planned day versus actual completion and blockers | All owners |

This is a review template with a factual status snapshot, not a claim that the sprint exit checks or retrospective meeting have passed.
