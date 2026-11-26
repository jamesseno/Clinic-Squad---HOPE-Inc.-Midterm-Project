# Sprint 3/4 Coverage Mapping

| Issue | Area | Document | SQL/static coverage | Execution |
|---|---|---|---|---|
| #81 | Department/job | s3-tst-01-department-job.md | s3_hr_access_test.sql | BLOCKED/partial |
| #89 | Employee | s3-tst-02-employee.md | s3_hr_access_test.sql | BLOCKED |
| #94 | Job history | s3-tst-03-job-history.md | s3_hr_access_test.sql | BLOCKED |
| #97 | HR salary/per-right | s3-tst-04-salary-hr-permissions.md | s3_hr_access_test.sql | BLOCKED |
| #101 | Sprint 1-2 regression | s3-tst-05-sprint1-2-regression.md | Existing S1/S2 test artifacts | BLOCKED |
| #102 | Bug/fix verification | s3-tst-06-bug-reports.md | Template only | NO DEFECTS VERIFIED |
| #55 | Sales/as-of-price | s4-tst-01-sales.md | s4_sales_access_test.sql | BLOCKED |
| #62 | Payments/balance | s4-tst-02-payments.md | s4_sales_access_test.sql | BLOCKED |
| #65 | Seven reports | s4-tst-03-seven-reports.md | s34_reports_audit_and_rights_test.sql | BLOCKED |
| #66 | E2E | s4-tst-04-e2e.md | Static/API review | BLOCKED |
| #71 | Full regression | s4-tst-05-full-regression.md | All test SQL/static artifacts | BLOCKED |
| #72 | Final sign-off | s4-tst-06-signoff.md | Coverage report | BLOCKED |

## Test status
No test is represented as passing merely because SQL text or static review exists. Hosted/API execution remains blocked until psql and `.env` become available in an authorized test environment.
