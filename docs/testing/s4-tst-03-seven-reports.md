# S4-TST-03 — Seven Report Tests

**Issue:** #65; **Status:** Not executed; no report pass is claimed

Rights: top_customers, product_master_list, top_products, active_employees, all_employees, employee_job_history, top_sales.

For every report test:
- direct report URL and `/api/reports/[report]`
- no-right, partial-right and authorized accounts
- from/to/asOf invalid ranges and topN 0, 1, 100, 101
- print/PDF/export if available

| Report | Reconciliation/edge cases |
|---|---|
| Top Customers | Sum line totals by custno, rank descending, tie policy, Top N |
| Product Master List | Active products; latest price <= asOf; no future/deleted price |
| Top Products | Quantity and amount; excludes deleted sales/details/products |
| Active Employees | Only active employees/jobs by business date |
| All Employees | Expected active/inactive/separated set by documented status |
| Employee Job History | Authorized salary visibility; latest ordering and effective dates |
| Top Sales | Sum transaction lines; ranking; date/customer/employee filters |

All export and print data must preserve the API/RLS authorization result.
