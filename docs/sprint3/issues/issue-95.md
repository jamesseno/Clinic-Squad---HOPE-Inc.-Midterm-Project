# S3-SM-04: Update velocity and Sprint 4 risk register

Issue: #95
Owner: `jamesseno`
Target: Sprint 3, day 8

## Velocity snapshot

| Measure | Count | Evidence |
|---|---:|---|
| Planned Sprint 3 issues | 30 | Issues #74–#103 |
| Sprint 3 issues open at review | 30 | GitHub issue state |
| Sprint 3 issues with merged PRs evidenced here | 0 | No Sprint 3 issue PR is linked in this report |
| Work present only in the local feature branch | Yes | Uncommitted changes; not counted as merged velocity |

Do not treat closed-but-unmerged PRs #191 and #192 as completed or merged work.

## Sprint 4 risk register

| Risk | Owner | Impact | Mitigation / exit evidence | Sprint 4 start |
|---|---|---|---|---|
| HR views, employee links, Job History, and per-right privacy are not merged and verified | Developer + DB Admin | Sales employee selection and protected history may be unavailable or unsafe | Issue-specific reviewed PRs; migration and direct-request permission tests | Blocked until core HR gate passes |
| Hosted Supabase environment and migration approval are unavailable | Project owner + DB Admin | RLS, triggers, auth, and migration behavior cannot be validated | Authorized non-production project; team approval; rebuild/test from migrations | Blocked for database sign-off |
| Sales feature implementation exists in closed-unmerged PR #192 | Developer + Scrum Master | Current `main` does not gain Sales from that PR | Recover changes into focused PRs without duplicate/placeholder work | Blocked for Sales acceptance |
| Payment, Reports, and Audit work needs dependent Sales data and rights | Developer + DB Admin | Features can render but produce unsafe or incorrect data if dependencies fail | Verify sale-date price, totals, balance, report rights, and audit isolation | Blocked for integration |
| All 60 Sprint 3/4 issue PRs, owners, and teammate reviews are not reconciled | Scrum Master + team | Grading and traceability requirements remain unmet | PR-per-issue tracker with actual author, assignee, reviewer, CI, and merge state | Blocks final release |
| E2E and full regression evidence is not available | Tester | Cross-module defects may remain undetected | Run role-based suites against approved test data and record failures | Blocks release |
| Peer evaluations require private team process | Scrum Master | Cannot claim complete submissions without evidence | Track received/pending only; keep response contents outside repository | Blocks final report completeness |

## Recommendation

Proceed with parallel issue work, but treat the HR/data security and authorized database validation as explicit gates. Update counts and risks from GitHub after PR creation and again before Sprint 4 acceptance; this snapshot is not the final velocity report.
