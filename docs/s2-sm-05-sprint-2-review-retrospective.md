# S2-SM-05 Sprint 2 review and retrospective

Related issue: #133

- Sprint: Sprint 2 - Customers and Products
- Milestone: `Sprint 2 — Customers and Products` (30 issues, #104-#133)
- Review date: 2026-11-22
- Repository state reviewed: `main` at `a159297`
- Evidence source: GitHub API (`state=all`, 100 per page, two pages), `git log
  origin/main`, the app tree, and the hosted schema probe recorded in
  `docs/testing/s2-tst-06-bug-reports.md`

## Headline

**Sprint 2 delivered 0 of its 30 planned tasks.** Every issue in the milestone is
still open, no branch or pull request references any of them, and none of the
customer or product code, views, wireframes or tests they describe exists in
`main`.

The work that did merge during the sprint window (PRs #145-#153) is Sprint 1
stabilisation: the rights dialog, audit attribution, permission matrix, bug
verification format, usability fixes and the Sprint 1 retrospective. That work
is real and valuable, but it is not Sprint 2 scope and must not be counted as
such.

## Planned versus actual

| Metric | Planned | Actual |
|---|---|---|
| Tasks in the milestone | 30 | 30 |
| Tasks closed | 30 | 0 |
| Task-linked PRs merged | 30 | 0 |
| Customer screens in `main` | list, create/edit, delete/restore | none |
| Product screens in `main` | list, create/edit, delete/restore, price history | none |
| Sprint 2 test cases written | 4 (customer, product, soft delete, per-right) | 0 |
| Hosted environment ready | yes | no (see D3) |

`app/` contains only `api`, `auth`, `dashboard`, `register-evidence`,
`set-password` and `users`. There is no `customers` or `products` route. No
`S2-` commit exists in `origin/main`.

## Task-by-task reconciliation

Status is the GitHub issue state on 2026-11-22. "Evidence" is what exists in
`main` for that task; "none" means no code, document, PR or test can be found.

| # | Task | Owner | Status | Evidence in `main` |
|---|---|---|---|---|
| 104 | S2-SM-01 Sprint 2 planning notes and board | jamesseno | Open | none |
| 105 | S2-DBA-01 Customer/product active views, indexes | BATOTS2007 | Open | none |
| 106 | S2-UIX-01 Wireframes: customer screens | nathaliejulialancado | Open | none |
| 107 | S2-DEV-01 Customer list with search and filter | princessbearoman | Open | none |
| 108 | S2-SM-02 Follow up Sprint 1 retro actions | jamesseno | Open | none |
| 109 | S2-UIX-02 Wireframes: product and price history | nathaliejulialancado | Open | none |
| 110 | S2-DEV-02 Customer create and edit form | princessbearoman | Open | none |
| 111 | S2-TST-01 Test cases: customer module | stfnviernes-afk | Open | none |
| 112 | S2-DBA-02 Query: current price as of a date | BATOTS2007 | Open | none |
| 113 | S2-DEV-03 Customer soft delete and restore | princessbearoman | Open | none |
| 114 | S2-SM-03 Mid-sprint check and impediment log | jamesseno | Open | none |
| 115 | S2-DBA-03 Validation constraints (payTerms, unit) | BATOTS2007 | Open | none |
| 116 | S2-UIX-03 Hi-fi mockups and handoff notes | nathaliejulialancado | Open | none |
| 117 | S2-DEV-04 Product list with search and filter | princessbearoman | Open | none |
| 118 | S2-TST-02 Test cases: product and price history | stfnviernes-afk | Open | none |
| 119 | S2-DBA-04 Child-record delete checks | BATOTS2007 | Open | none |
| 120 | S2-DEV-05 Product create and edit form | princessbearoman | Open | none |
| 121 | S2-DBA-05 Demo data for customer/product/price history | BATOTS2007 | Open | none |
| 122 | S2-UIX-04 Empty, error and confirm-delete states | nathaliejulialancado | Open | none |
| 123 | S2-DEV-06 Product soft delete and restore | princessbearoman | Open | none |
| 124 | S2-TST-03 Soft delete/restore tests | stfnviernes-afk | Open | none |
| 125 | S2-SM-04 Update velocity and burndown | jamesseno | Open | none |
| 126 | S2-DEV-07 Price history | princessbearoman | Open | none |
| 127 | S2-TST-04 Per-right permission tests | stfnviernes-afk | Open | none |
| 128 | S2-DBA-06 Search performance check and index tuning | BATOTS2007 | Open | none |
| 129 | S2-UIX-05 Usability review of built screens | nathaliejulialancado | Open | none |
| 130 | S2-DEV-08 Current-price display and rights checks | princessbearoman | Open | none |
| 131 | S2-TST-05 Regression test of Sprint 1 | stfnviernes-afk | Open | this report's sibling PR |
| 132 | S2-TST-06 Bug reports and fix verification | stfnviernes-afk | Open | this report's sibling PR |
| 133 | S2-SM-05 Sprint 2 review and retrospective | jamesseno | Open | this document |

The three testing/review tasks (#131-#133) are being delivered now; they are the
only Sprint 2 tasks with evidence, and they document the gap rather than fill it.

## Why Sprint 2 did not start

Three causes, in order of impact:

1. **The hosted database was never brought to the Sprint 1 schema.** Only the
   identity tables exist. `audit_log` and all eleven HOPE business tables are
   absent (defect D3). Customer and product work cannot be built, seeded,
   queried or tested against the environment the team shares.
2. **No Sprint 2 board or plan was published.** S2-SM-01 (#104) was never
   completed, so there was no agreed task order, no definition of done per
   screen, and no impediment log (#114) to surface cause 1 early.
3. **Sprint 1 follow-up work consumed the window.** PRs #145-#153 merged rights,
   audit, permission-matrix and usability work that was still open when Sprint 2
   began. That work was necessary, but it was not re-planned, so Sprint 2
   capacity was spent without Sprint 2 output.

## Sprint 3 entry criteria

| Criterion | Status | Evidence |
|---|---|---|
| Hosted schema matches `main` (11 business tables + `audit_log`) | **Not met** | D3: `PGRST205` on every table |
| `set_user_rights` deployed and rights save works hosted | **Not met** | D1: `PUT /rights` returns 500 |
| Sprint 1 regression suite green | **Partly met** | #131: 6 of 8 areas pass, 3 checks fail (2 test fixture, 1 deployment) |
| Real reset-link delivery captured | **Not met** | #131: no mailbox/provider evidence |
| Sprint 2 board and task order agreed | **Not met** | #104 open |
| Customer and product screens exist | **Not met** | no routes in `app/` |
| Defect log triaged with owners | **Met** | `docs/testing/s2-tst-06-bug-reports.md` |

Sprint 3 should not start until the first two criteria are met. They are single
deployment actions, not development work, and every customer/product task
depends on them.

## Open defects carried into Sprint 3

| ID | Severity | Owner | Exit condition |
|---|---|---|---|
| D1 | High | BATOTS2007 | `verify-user-rights.mjs` passes on hosted |
| D2 | Medium | stfnviernes-afk | Both superadmin runners pass on shared data |
| D3 | Critical | BATOTS2007 | 11-table probe returns rows; one audited action recorded |
| D5 | Low | princessbearoman | **Fixed in the #132 PR**; `npm run lint` clean for `app/users/page.tsx` |

D4 is closed; it was a dev-server compile race.

## Assigned follow-ups

| # | Action | Owner | Due |
|---|---|---|---|
| 1 | Apply pending migrations + seed to hosted, then re-probe | BATOTS2007 | Before Sprint 3 day 1 |
| 2 | Confirm rights save and one audit row on hosted | BATOTS2007 / stfnviernes-afk | Before Sprint 3 day 1 |
| 3 | Fix superadmin assertions in the two runners | stfnviernes-afk | Sprint 3 day 2 |
| 4 | Remove dead rights-dialog state (`D5`) | princessbearoman | Done in the #132 PR |
| 5 | Publish Sprint 3 board with customer first, then product | jamesseno | Sprint 3 planning |
| 6 | Capture real reset-link delivery | stfnviernes-afk | Sprint 3 day 3 |
| 7 | Re-run #131 suite after the migrations land and attach logs | stfnviernes-afk | Sprint 3 day 3 |

## Retrospective

### What went well

- Sprint 1 was genuinely closed out: the rights dialog, JWT-based audit
  attribution, permission matrix and bug-verification format all merged with
  evidence (PRs #145-#153).
- Verification is scripted, so the current state of the system can be re-proven
  in minutes rather than by memory.
- The gaps are now measured rather than assumed: the schema probe and the
  regression run produced specific, reproducible facts.

### What did not go well

- A whole sprint passed with no Sprint 2 feature merged and no early warning.
- Deployment was treated as someone else's later step, so the environment
  drifted from `main` for the entire sprint.
- Follow-up work was absorbed silently instead of being re-planned against
  Sprint 2 scope.
- Test scripts assumed exclusive ownership of shared hosted data, producing two
  false failures that cost time to diagnose (D2).

### Actions

1. **Definition of Done includes deployment.** A task is not done until its
   migration is applied to the shared project and the hosted check passes.
2. **Environment check is the first item of every sprint.** Run the schema probe
   and the regression suite before planning, not after building.
3. **No silent carry-over.** Any Sprint 1 follow-up pulled into a sprint is
   logged as a task with its own estimate.
4. **Shared-data-safe tests.** Runners must either isolate their data or branch
   on the real state of the database.
5. **Daily impediment line in the mid-sprint log**, even when the answer is
   "nothing blocking".

## Honest verdict

Sprint 2's goal - working, permission-checked customer and product screens with
soft delete, restore and price history - was **not met**. The sprint produced a
regression report, a defect log and this review. Sprint 3 can only succeed if
the hosted environment is brought in line with `main` first.
