# S3-TST-01 — Department and Job Test Cases

**Issue:** #81; **Status:** Not executed; **Evidence:** none

## Scope
Department and job CRUD, filtering, soft-delete/restore, duplicate data, inactive records and child-record restrictions.

| ID | Case | Roles/rights | Steps | Expected |
|---|---|---|---|---|
| DJ-P-01 | Create valid department | superadmin/admin with add_department | POST/create department with unique code and name | 201/record created |
| DJ-P-02 | Edit department | edit_department | Change an active department | Edit succeeds; audit record contains actor |
| DJ-P-03 | Restore deleted department | delete_department | Set is_deleted=false | Active view includes record |
| DJ-N-01 | Duplicate department code/name | add_department | Submit an existing code and/or name | 400/409; no duplicate row |
| DJ-N-02 | Invalid or over-length codes | add_department | Empty code, wrong shape, or >3 dept characters | 400; no insert |
| DJ-N-03 | Delete department with active jobs/employees | delete_department | Soft-delete department used by active job history | Reject child-record/delete violation |
| DJ-N-04 | No-right department add/edit/delete | user, partial right accounts | Call UI action and direct API/URL | 403/denied; no row or state change |
| DJ-P-04 | Create/edit valid job | add_job/edit_job | Unique code and description | Record created/updated |
| DJ-N-05 | Duplicate job code | add_job | Reuse existing jobcode | 409; no duplicate |
| DJ-N-06 | Soft-delete/restore inactive job | delete_job | Delete unused job, restore it | Deleted hidden; restore returns it |

## Direct-RLS checks
Run with authenticated users holding only view, only add/edit, delete, and no HR rights. Verify read, insert, update and is_deleted changes are each blocked independently.
