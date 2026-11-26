# Sprint 3/4 Role and Right Matrix

## Roles
- `anonymous`: no application data.
- `user`: no default HR/sales/report/audit rights.
- `admin`: Customer/Product grants plus Sprint 3/4 rights if seed/migrations leave them assigned.
- `superadmin`: full rights from seed; audit additionally requires role code and view_audit_log.

| Area | Right | Anonymous | user | admin | superadmin |
|---|---|---:|---:|---:|---:|
| Department | view/add/edit/delete_* | No | No default | Per catalog | Yes |
| Job | view/add/edit/delete_* | No | No default | Per catalog | Yes |
| Employee | view/add/edit/delete_* | No | No default | Per catalog | Yes |
| Job history/salary | view/add/edit/delete_* | No | No default | Per catalog | Yes |
| Sale | view/add/edit/delete_sale | No | No default | Per catalog | Yes |
| Sale detail | view/add/edit/delete_sale_detail | No | No default | Per catalog | Yes |
| Payment | view/add/edit/delete_payment | No | No default | Per catalog | Yes |
| Reports | seven report rights | No | No default | Per catalog | Yes |
| Audit | view_audit_log | No | No | No (migration enforces superadmin only) | Yes |

## Protected operations
UI hiding is insufficient: API and RLS must independently enforce rights. Deleted records require delete rights for visibility/restore as implemented.

## Current implementation observations
- HR/Sales/SalesDetail/Payment use per-right RLS and guard triggers.
- Job history active uniqueness is employee/effective-date scoped.
- Sale detail and payment guards prevent unsupported totals.
- Audit is superadmin-only in API and RLS.
- Report API checks the report-specific right; export/print must use the same right.
- PR #191 (Sprint 3) and PR #192 (Sprint 4) are closed but unmerged; this delivery is not evidence of merge/release state.
