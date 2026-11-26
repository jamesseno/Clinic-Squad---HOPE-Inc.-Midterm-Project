# S3-TST-02 — Employee Test Cases

**Issue:** #89; **Status:** Not executed; **Evidence:** none

| ID | Case | Steps | Expected |
|---|---|---|---|
| EMP-P-01 | Employee list/search | Search by name/code/status; combine filters | Only authorized active or deleted records as permitted |
| EMP-P-02 | Create/edit employee | Valid name, gender, hire date and optional separation date | 201/edit success |
| EMP-P-03 | Separated employee | Set separation date; filter inactive/separated | Record retained, status/filter correct, write rights still enforced |
| EMP-N-01 | Separation before hire | Separation date < hire date | 400/rejection |
| EMP-N-02 | Invalid/birth date | Invalid calendar date or future birth date when prohibited | 400; no mutation |
| EMP-N-03 | Restricted personal data | Read employee direct URL/API with no view/add/edit/delete right | 403 or zero rows under RLS |
| EMP-N-04 | Employee write via API | No add/edit/delete right; send POST/PUT and is_deleted change | 403/RLS 42501; no mutation |
| EMP-B-01 | Boundary name/code | Minimum/maximum accepted code and text lengths | Only documented boundaries accepted |

## Privacy verification
For partial rights, confirm salary and job-history fields are absent when view_job_history is not granted and employee fields are absent when view_employee is not granted.
