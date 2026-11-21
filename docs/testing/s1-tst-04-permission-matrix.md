# S1-TST-04 Permission Matrix

Related issue: #28

| Role | Customer | Product | Human Resources | Sales | Reports |
|---|---|---|---|---|---|
| Superadmin | All module and action rights | All module and action rights | All module and action rights | All module and action rights | All module and action rights |
| Admin | No automatic module rights; can manage standard User rights | No automatic module rights; can manage standard User rights | No automatic module rights; can manage standard User rights | No automatic module rights; can manage standard User rights | No automatic module rights; can manage standard User rights |
| User | Only granted `user_permission` rows | Only granted `user_permission` rows | Only granted `user_permission` rows | Only granted `user_permission` rows | Only granted `user_permission` rows |

## Action catalogue

- Customer: 3 rights
- Product: 6 rights
- Human Resources: 13 rights
- Sales: 7 rights
- Reports: 7 rights

## Negative checks

- Standard Users cannot call the rights management API.
- Admin accounts cannot manage Admin or Superadmin targets.
- Unknown right IDs are rejected.
- Server-side dashboard visibility matches the persisted grants.
- The UI hides modules and actions that are not in the effective permission set.

Run `npm.cmd run verify:rights` against an integration environment. The runner verifies all 36 catalogue actions, active grants, audit ADD/DELETE/RESTORE attribution, and role boundaries.
