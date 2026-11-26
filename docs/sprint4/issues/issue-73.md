# S4-SM-05: Final review, retrospective and project report

Issue: #73
Owner: `jamesseno`
Target: Sprint 4, day 10

## Final report status

**Release decision: blocked / not yet assessed.** The Sprint 4 issues #44–#73 are open in the current GitHub snapshot. PR #191 and #192 are closed without merging, and this work has not established hosted database, auth, or SMTP verification. Do not present local implementation or a planned PR as merged project completion.

## Required evidence before the release decision

| Area | Required evidence | Current status |
|---|---|---|
| Issue/PR reconciliation | 30 issue-specific PRs, correct assignees, teammate reviews, CI and merge states | Pending |
| Sales and price history | Sale creation, line totals, price effective on sale date, protected delete/restore | Pending full acceptance |
| Payments and balances | Payment create/edit/delete/restore, overpayment handling, transaction/customer reconciliation | Pending full acceptance |
| Seven Reports | Per-report right, filters, correct data, print/PDF and denial cases | Pending full acceptance |
| Audit | Superadmin-only page/API/data, filters, privacy denial tests | Pending full acceptance |
| Database | Approved migration run, RLS/trigger tests, rebuild and backup/restore evidence | Not verified in hosted/test PostgreSQL |
| Authentication | Invite/reset/SMTP/redirect and role-assignment behavior | Not verified in hosted environment |
| Test quality | E2E, full regression, defect verification and sign-off | Pending |
| README/demo | Reproducible setup, release checklist and accurate demonstration | Pending |
| Peer evaluations | Receipt status only, handled privately | Pending verification |

## Retrospective capture template

At the final team review, record actual evidence for:

- What shipped and what did not, by issue and merged PR.
- Planned versus actual completion and the reason for material variance.
- Defects found, their severity, and whether fixes were re-tested.
- Handoffs that helped or delayed delivery across Scrum, DB, UI/UX, Developer, and Tester roles.
- Follow-up actions with a named owner and target date.

Do not claim the sprint passed its exit gate while any critical auth, authorization, privacy, data-integrity, or report test is failing or unverified.
