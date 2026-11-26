# S4-TST-02 — Payment and Balance Tests

**Issue:** #62; **Status:** Static review + rollback SQL test; hosted verification blocked

| ID | Case | Expected |
|---|---|---|
| PAY-P-01 | Full payment | paid = total, balance = 0 |
| PAY-P-02 | Multiple partial payments | Sum amounts reconciles; balance is total - sum(active payments) |
| PAY-P-03 | Delete/restore payment | Delete reduces paid and increases balance; restore recalculates and cannot overpay |
| PAY-N-01 | Zero/negative/NaN/extra decimals | 400/reject |
| PAY-N-02 | Unknown/inactive transno | 404/23503 |
| PAY-N-03 | Duplicate receipt number | 409/23505 |
| PAY-N-04 | Overpayment | 409 or database 23514 |
| PAY-N-05 | Reduce line below paid amount | Reject; transaction remains unchanged |
| PAY-N-06 | No payment rights | UI/API/RLS deny view, add, edit, delete independently |
| PAY-B-01 | Payment exactly equal balance | Accepted |
| PAY-B-02 | Amount just above balance | Rejected |
