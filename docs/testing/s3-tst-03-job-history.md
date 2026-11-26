# S3-TST-03 — Job History and Effective Date Tests

**Issue:** #94; **Status:** Blocked from hosted execution; SQL guard test available

| ID | Case | Expected |
|---|---|---|
| JH-P-01 | Create first job history entry | Entry created and current-job view selects it |
| JH-P-02 | Add later effective-date entry | Latest effective date becomes current job; older entry remains |
| JH-P-03 | Restore job history | Restored entry participates only if it is the latest active entry |
| JH-N-01 | Duplicate effective date | Unique active employee/effective-date constraint rejects insert/update |
| JH-N-02 | Out-of-order date | Date ordering derives current record by greatest effdate, not row insertion order |
| JH-N-03 | Missing/invalid employee, job or department | Foreign-key/validation rejection |
| JH-N-04 | Negative/zero salary | Reject when business validation applies |
| JH-N-05 | Delete active history entry | Reject/delete behavior follows documented right and referential rules |
| JH-B-01 | Same effective date across different employees | Allowed; uniqueness is employee-scoped |
| JH-B-02 | Same employee date after soft-delete | Constraint allows a replacement only while a previously deleted row is excluded; verify documented restore behavior |

## SQL
`supabase/tests/s3_hr_access_test.sql` covers catalogue, role variants, insert/read, duplicate effective date and rollback.
