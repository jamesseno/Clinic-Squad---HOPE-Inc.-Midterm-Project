# S1-TST-02 Authentication Test Cases

Related issue: #21

## Automated coverage

The existing verification runner covers registration, login, logout, pending and blocked accounts, password setup, and reset flows:

- `npm run verify:registration`
- `npm run verify:auth`
- `npm run verify:reset`

Run against an integration environment with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ORIGIN` configured.

## Test matrix

| ID | Case | Expected result | Evidence |
|---|---|---|---|
| AUTH-01 | Register with valid details | Pending profile is created; no role is browser-selected | Registration verification |
| AUTH-02 | Register with duplicate or invalid data | Duplicate/invalid request is rejected | Registration verification |
| AUTH-03 | Login with valid active credentials | Session and dashboard access are granted | Auth verification |
| AUTH-04 | Login with a wrong password | HTTP 401 is returned | Auth verification |
| AUTH-05 | Login while pending or blocked | Access is denied and no session remains | Auth verification |
| AUTH-06 | Logout | Session cookie is removed | Auth verification |
| AUTH-07 | Set first password with a valid invitation | Password is updated; setup requirement is cleared | Reset/setup verification |
| AUTH-08 | Request password reset | Reset request is acknowledged without account enumeration | Reset verification |
| AUTH-09 | Reuse or use an expired reset token | Request is rejected; password remains unchanged | Reset verification |

## Security expectations

- Account status and role are read from trusted server-side Supabase data.
- Browser payload fields cannot grant a role or change account status.
- Protected session requests must return 401 after logout or invalidation.
