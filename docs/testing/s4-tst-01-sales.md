# S4-TST-01 — Sales Transaction and Price-as-of-Date

**Issue:** #55; **Status:** SQL test present; hosted E2E blocked

| ID | Case | Expected |
|---|---|---|
| SAL-P-01 | Sale with multiple lines | Header valid; all lines retained; reconciliation equals sum(quantity * effective price) |
| SAL-P-02 | Historical price | Each line uses greatest price.effdate <= salesdate and excludes deleted prices |
| SAL-P-03 | Edit quantity | Recalculate total and balance; no payment can become unsupported |
| SAL-N-01 | Product has no effective price | Reject insert with clear 4xx/23514 |
| SAL-N-02 | Invalid/deleted customer | Reject |
| SAL-N-03 | Invalid/deleted employee | Reject |
| SAL-N-04 | Duplicate transaction/receipt key | 409/23505; no duplicate |
| SAL-N-05 | Zero/negative/over-limit quantity | Reject; at most two decimal places |
| SAL-N-06 | Delete sale with active detail/payment | Reject; soft-delete is allowed only when guard policy permits |
| SAL-B-01 | Price effective exactly on sales date | Accepted and used |
| SAL-B-02 | Max line quantity/amount | Enforce documented numeric limits |
