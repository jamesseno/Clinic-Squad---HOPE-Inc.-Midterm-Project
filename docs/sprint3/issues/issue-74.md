# S3-SM-01: Sprint 3 planning notes and board

Issue: #74
Owner: `jamesseno`
Target: Sprint 3, day 1

## Sprint goal

Deliver Department, Job, Employee, and Job History functionality with per-right access control, salary/history privacy, regression coverage, and a documented handoff to Sprint 4.

## Task board

| Day | Task / issue | Role and owner | Planned handoff |
|---:|---|---|---|
| 1 | S3-SM-01 / #74 | Scrum Master / `jamesseno` | Publish plan and board |
| 2 | S3-DBA-01 / #75 | DB Admin / `BATOTS2007` | Current-job and department views |
| 2 | S3-UIX-01 / #76 | UI/UX / `nathaliejulialancado` | Department and Job wireframes |
| 2 | S3-DEV-01 / #77 | Developer / `princessbearoman` | Department list and CRUD |
| 3 | S3-SM-02 / #78 | Scrum Master / `jamesseno` | Carryover disposition |
| 3 | S3-UIX-02 / #79 | UI/UX / `nathaliejulialancado` | Employee/profile wireframes |
| 3 | S3-DEV-02 / #80 | Developer / `princessbearoman` | Job list and CRUD |
| 3 | S3-TST-01 / #81 | Tester / `stfnviernes-afk` | Department and Job cases |
| 4 | S3-DBA-02 / #82 | DB Admin / `BATOTS2007` | Effective-date validation |
| 4 | S3-UIX-03 / #83 | UI/UX / `nathaliejulialancado` | Job timeline design |
| 4 | S3-DEV-03 / #84 | Developer / `princessbearoman` | Employee search and filter |
| 5 | S3-SM-03 / #85 | Scrum Master / `jamesseno` | Mid-sprint status and blockers |
| 5 | S3-DBA-03 / #86 | DB Admin / `BATOTS2007` | `app_user.empno` relationship |
| 5 | S3-UIX-04 / #87 | UI/UX / `nathaliejulialancado` | Hi-fi mockups and handoff |
| 5 | S3-DEV-04 / #88 | Developer / `princessbearoman` | Employee create/edit |
| 5 | S3-TST-02 / #89 | Tester / `stfnviernes-afk` | Employee test cases |
| 6 | S3-DBA-04 / #90 | DB Admin / `BATOTS2007` | Child-record deletion rules |
| 6 | S3-DEV-05 / #91 | Developer / `princessbearoman` | Separation date and restore |
| 7 | S3-DBA-05 / #92 | DB Admin / `BATOTS2007` | Safe HR demo data |
| 7 | S3-DEV-06 / #93 | Developer / `princessbearoman` | Job History mutations |
| 7 | S3-TST-03 / #94 | Tester / `stfnviernes-afk` | Effective date and salary tests |
| 8 | S3-SM-04 / #95 | Scrum Master / `jamesseno` | Velocity and Sprint 4 risks |
| 8 | S3-DEV-07 / #96 | Developer / `princessbearoman` | Employee profile/timeline |
| 8 | S3-TST-04 / #97 | Tester / `stfnviernes-afk` | Salary and per-right tests |
| 9 | S3-DBA-06 / #98 | DB Admin / `BATOTS2007` | Index and backup/restore review |
| 9 | S3-UIX-05 / #99 | UI/UX / `nathaliejulialancado` | Built-screen usability review |
| 9 | S3-DEV-08 / #100 | Developer / `princessbearoman` | Job-history privacy enforcement |
| 9 | S3-TST-05 / #101 | Tester / `stfnviernes-afk` | Sprint 1/2 regression |
| 9 | S3-TST-06 / #102 | Tester / `stfnviernes-afk` | Bug reports and fix verification |
| 10 | S3-SM-05 / #103 | Scrum Master / `jamesseno` | Review, retrospective, Sprint 4 gate |

## Dependencies and gates

- Sprint 2 Customer, Product, Price History, authentication, and rights work is a prerequisite; GitHub currently has no open Sprint 2 issues.
- HR views and `app_user.empno` must be available before employee-linked permissions and Sales work rely on them.
- Salary and Job History data must remain unavailable without the corresponding right, including on direct API requests.
- The Sprint 4 entry gate remains blocked until HR behavior, database migration execution, and regression results are evidenced.

## Status

This is the planned board, not a completion report. The 30 Sprint 3 issues are still open in GitHub; reviews, merges, and hosted database verification must be recorded as they occur.
