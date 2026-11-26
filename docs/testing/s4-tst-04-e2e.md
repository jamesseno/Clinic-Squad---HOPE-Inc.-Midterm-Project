# S4-TST-04 — End-to-End Approved-User Flow

**Issue:** #66; **Status:** Blocked for hosted execution; psql/.env absent

Approved path:
1. Register legitimate test account.
2. Obtain approval through a superadmin/account authorized in the test environment.
3. Assign required role/rights.
4. Set first password/sign in.
5. Create a sale for an active customer and employee.
6. Add two or more active product lines.
7. Verify historical prices and sale total.
8. Record a partial payment and reconcile balance.
9. Record the remaining payment and verify zero balance.
10. Run each authorized report and audit page.
11. Verify audit entries identify actor/actions and no unrelated data is exposed.

Stop and mark BLOCKED if email delivery, hosted credentials or database access is unavailable. Do not substitute fabricated evidence.
