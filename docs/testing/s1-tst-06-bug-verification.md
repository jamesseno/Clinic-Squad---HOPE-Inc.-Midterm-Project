# S1-TST-06 Bug Reports and Fix Verification

Related issue: #11

## Bug report format

For each failing check, record:

1. Environment and build/commit tested
2. Role and test account state
3. Preconditions
4. Exact request or browser action
5. Expected result
6. Actual result and HTTP status
7. Screenshot or log evidence
8. Severity and owner
9. Fix commit or PR
10. Retest result

## Sprint 1 verification log

| Area | Status | Evidence |
|---|---|---|
| Authentication | PASS when integration credentials are configured | `scripts/verify-auth.mjs` |
| Registration | PASS when integration credentials are configured | `scripts/verify-registration.mjs` |
| Password reset | PASS when integration credentials are configured | `scripts/verify-reset-password.mjs` |
| User management | PASS when integration credentials are configured | `scripts/verify-user-management.mjs` |
| Approval guards | PASS when integration credentials are configured | `scripts/verify-user-approval.mjs` |
| User rights/audit | PASS when integration credentials are configured | `scripts/verify-user-rights.mjs` |
| Login/dashboard smoke | PASS when integration credentials are configured | `scripts/smoke-login-dashboard.mjs` |
| Production build | PASS | `npm.cmd run build` |

## Fix closure rule

A bug is closed only after the regression test, verification runner, and a targeted build/lint/typecheck pass.
