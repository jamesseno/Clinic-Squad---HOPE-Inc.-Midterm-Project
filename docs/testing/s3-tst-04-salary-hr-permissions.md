# S3-TST-04 — Salary Visibility and HR Per-Right Matrix

**Issue:** #97; **Status:** Not executed

Test accounts: unauthenticated, user, partial-HR, admin and superadmin. Direct URL/API attempts are mandatory for every write right.

| Right | View | Add | Edit | Delete/restore |
|---|---:|---:|---:|---:|
| department | view_department | add_department | edit_department | delete_department |
| job | view_job | add_job | edit_job | delete_job |
| employee | view_employee | add_employee | edit_employee | delete_employee |
| job history/salary | view_job_history | add_job_history | edit_job_history | delete_job_history |

Cases:
1. No HR right: no UI action, no data in API/RLS, 403 direct route.
2. View-only: read succeeds; add/edit/delete fail.
3. Partial write right: only its own operation succeeds; independent rights are denied.
4. Salary leak: employee/profile/job-history response and direct SQL/API cannot expose salary without view_job_history.
5. Role change: remove a right while signed in, refresh and repeat every operation; cached UI must not grant API access.
6. Reactivate: grant right, verify the operation works and audit captures actor.
