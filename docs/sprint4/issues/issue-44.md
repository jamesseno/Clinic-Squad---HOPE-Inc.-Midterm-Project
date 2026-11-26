# S4-SM-01: Sprint 4 planning notes and board

Issue: #44
Owner: `jamesseno`
Target: Sprint 4, day 1

## Sprint goal

Deliver Sales, sale details with historical unit prices, Payments and balances, all seven Reports, a protected Audit Viewer, and release evidence without weakening existing role/right controls.

## Task board

| Day | Task / issue | Role and owner | Planned handoff |
|---:|---|---|---|
| 1 | S4-SM-01 / #44 | Scrum Master / `jamesseno` | Publish plan and dependencies |
| 2 | S4-DBA-01 / #45 | DB Admin / `BATOTS2007` | Sales line/transaction totals |
| 2 | S4-UIX-01 / #46 | UI/UX / `nathaliejulialancado` | Sales entry/detail wireframes |
| 3 | S4-UIX-02 / #47 | UI/UX / `nathaliejulialancado` | Payment/balance wireframes |
| 3 | S4-DEV-01 / #48 | Developer / `princessbearoman` | Sales list and header |
| 4 | S4-DBA-02 / #49 | DB Admin / `BATOTS2007` | Payment balance view |
| 4 | S4-UIX-03 / #50 | UI/UX / `nathaliejulialancado` | Reports/Audit design |
| 5 | S4-SM-02 / #51 | Scrum Master / `jamesseno` | Mid-sprint blocker review |
| 5 | S4-DBA-03 / #52 | DB Admin / `BATOTS2007` | Queries for seven Reports |
| 5 | S4-UIX-04 / #53 | UI/UX / `nathaliejulialancado` | Hi-fi mockups/handoff |
| 5 | S4-DEV-02 / #54 | Developer / `princessbearoman` | Sale details and unit price |
| 5 | S4-TST-01 / #55 | Tester / `stfnviernes-afk` | Sale/price-as-of-date cases |
| 6 | S4-DBA-04 / #56 | DB Admin / `BATOTS2007` | Audit query and filters |
| 6 | S4-DEV-03 / #57 | Developer / `princessbearoman` | Payment recording |
| 6 | S4-DEV-04 / #58 | Developer / `princessbearoman` | Reports module, part 1 |
| 7 | S4-DBA-05 / #59 | DB Admin / `BATOTS2007` | Sale delete rules |
| 7 | S4-DEV-05 / #60 | Developer / `princessbearoman` | Reports module, part 2 |
| 7 | S4-DEV-06 / #61 | Developer / `princessbearoman` | Transaction/customer balances |
| 7 | S4-TST-02 / #62 | Tester / `stfnviernes-afk` | Payment/balance tests |
| 8 | S4-SM-03 / #63 | Scrum Master / `jamesseno` | Release checklist/demo |
| 8 | S4-DEV-07 / #64 | Developer / `princessbearoman` | Sale soft-delete/restore |
| 8 | S4-TST-03 / #65 | Tester / `stfnviernes-afk` | Seven-report tests |
| 8 | S4-TST-04 / #66 | Tester / `stfnviernes-afk` | End-to-end test |
| 9 | S4-SM-04 / #67 | Scrum Master / `jamesseno` | Peer-evaluation status |
| 9 | S4-DBA-06 / #68 | DB Admin / `BATOTS2007` | DB rebuild, backup, docs |
| 9 | S4-UIX-05 / #69 | UI/UX / `nathaliejulialancado` | Consistency/usability pass |
| 9 | S4-DEV-08 / #70 | Developer / `princessbearoman` | Superadmin Audit Viewer |
| 9 | S4-TST-05 / #71 | Tester / `stfnviernes-afk` | Full module regression |
| 9 | S4-TST-06 / #72 | Tester / `stfnviernes-afk` | Final test sign-off |
| 10 | S4-SM-05 / #73 | Scrum Master / `jamesseno` | Final review and report |

## Dependency map and release gates

- Customer, Product, PRICEHIST, Employee, and JOBHISTORY must exist and be usable before Sales acceptance.
- A line price must be selected from a valid price effective on the sale date; future-dated prices are not eligible.
- Payment totals and balances must reconcile with active sales/details/payments; overpayment and deleted-sale edge cases require tests.
- Each report must have its own right; the Audit Viewer and audit data must be restricted to superadmin.
- Final sign-off requires approved non-production migration execution, auth/permission tests, E2E/regression evidence, teammate review, and a documented backup/rebuild.

## Authentication and permission release blocker

The current workspace cannot verify hosted authentication, RLS, or direct-request permission behavior because no authorized non-production Supabase environment is configured. This is a verification blocker, not a confirmed security defect. Owners: Developer and Tester; they must record any reproduced defect, assign a named fix owner, and keep release sign-off blocked until denial/allow cases pass.

## Status

This is the planned board. All Sprint 4 issues are currently open; the schedule does not imply completion or teammate review.
