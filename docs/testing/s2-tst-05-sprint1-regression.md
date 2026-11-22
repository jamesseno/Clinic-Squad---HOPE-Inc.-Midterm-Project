# S2-TST-05 Sprint 1 regression results

Related issue: #131

Re-ran every Sprint 1 verification runner against the merged `main` tip and the
shared hosted Supabase project, then recorded what actually passed, what failed,
and which failures are product defects versus environment or test-fixture
problems.

- Commit under test: `a159297` (`origin/main`, merge of PR #153)
- Run date: 2026-11-22
- App: local `next dev` on `http://localhost:3001`, `APP_ORIGIN` set to the same
- Database: shared hosted Supabase project referenced by `.env.local`
- Node `v26.13.1`, Next.js `16.4.6`

Raw runner output is committed next to this file in
`docs/testing/evidence/s2-tst-05/`.

## Result summary

| # | Sprint 1 area | Runner | Checks passed | Result |
|---|---|---|---|---|
| 1 | Registration and pending account (S1-DEV-02) | `verify-registration.mjs` | 9 / 9 | PASS |
| 2 | Authentication, first password, blocked user (S1-DEV-03) | `verify-auth.mjs` | 24 / 24 | PASS |
| 3 | Seed catalogue and role matrix (S1-DBA-05) | `verify-seed.mjs` | 11 / 11 | PASS |
| 4 | Login/dashboard smoke test (S1-TST-05) | `smoke-login-dashboard.mjs` | 4 / 4 | PASS |
| 5 | User management, roles, block/unblock (S1-DEV-04) | `verify-user-management.mjs` | 26 / 27 | FAIL at check 27 |
| 6 | Superadmin approval and protection (S1-DEV-05) | `verify-user-approval.mjs` | 10 / 11 | FAIL at check 11 |
| 7 | Rights dialog read + save + audit (S1-DEV-07) | `verify-user-rights.mjs` | 8 / 9 | FAIL at check 9 |
| 8 | Reset password token lifecycle (S1-DEV-04) | `verify-reset-password.mjs` | 22 / 22 | PASS |

Passing areas in detail:

- Registration rejects server-controlled fields, creates a `pending` standard
  `user` profile, rejects duplicate emails with 409, and keeps the account
  pending after an unauthorized status update.
- Authentication rejects server-controlled login fields, rejects bad passwords,
  establishes and destroys sessions, blocks a signed-in user mid-session,
  refuses pending users, and completes the first-password flow including
  invalidation of the temporary password.
- Seed data still has 3 roles, 5 modules and 36 rights in the 3 / 6 / 13 / 7 / 7
  split, with 36 Superadmin grants and 0 default Admin/User grants.
- The smoke test proves signed-out dashboard access is denied, login creates a
  session, the dashboard renders role-aware modules, and logout invalidates
  access.
- The reset runner proves the full token lifecycle inside the app: hashed token
  storage with a future expiry, generic response for unknown emails, weak and
  mismatched passwords rejected, single use, expiry, malformed and unknown
  tokens rejected, a newer request revoking the older token, and blocked or
  pending accounts receiving no token. All 22 checks pass. What it does **not**
  prove is that an email actually arrived - see "Link delivery" below.

## Failure 1 - "last active superadmin cannot be blocked" (check 27)

Observed:

```text
✓ admin can unblock a standard user (HTTP 200)
✓ unblocked user can sign in again (HTTP 200)
Error: FAILED: last active superadmin cannot be blocked (HTTP 409)
```

Expected: blocking the only active Superadmin returns `409`.
Actual: `200`, and the account is blocked.

Root cause: not a product regression. `getLastActiveSuperadminId()` in
`lib/user-management.ts` deliberately returns an id only when **exactly one**
active, unblocked Superadmin exists. The shared hosted project already contains
a real team Superadmin (`senomj6@gmail.com`), so the throwaway Superadmin the
runner creates is never "the last one" and the guard correctly allows the block.
The runner assumes exclusive ownership of the role.

Classification: test-fixture isolation defect, not a product defect. Logged as
D2 in `docs/testing/s2-tst-06-bug-reports.md`.

## Failure 2 - "last active superadmin row is marked protected" (check 11)

Observed:

```text
✓ superadmin can open user management (HTTP 200)
Error: FAILED: last active superadmin row is marked protected
```

Same root cause as Failure 1: with two active Superadmins, no row is flagged
`protected`, so `listedSuperadmin.protected` is `false`. The follow-up assertion
("only the last active superadmin row is protected") would also fail.

Classification: test-fixture isolation defect, not a product defect (D2).

## Failure 3 - rights save returns HTTP 500 (check 9)

Observed:

```text
✓ Customer module exposes three per-action rights
Error: FAILED: admin grants selected Customer rights (HTTP 200)
```

Server log:

```text
Rights update failed: Could not find the function
public.set_user_rights(p_right_ids, p_user_id) in the schema cache
PUT /api/users/<id>/rights 500
```

Expected: saving the three Customer rights returns `200` and persists them.
Actual: `500`, nothing is written.

Root cause: the hosted database is missing migration
`20261121130000_user_rights_audit_and_rpc.sql`. The dialog renders and reads
correctly (all eight earlier checks pass), but every save fails because the RPC
does not exist. This is a deployment gap, not a code defect: the migration is
merged in `main` but was never pushed to the hosted project.

Classification: deployment blocker (D1). It blocks hosted sign-off of
S1-DEV-07 / #26 and any Sprint 2 rights-dependent test.

## Hosted schema gap discovered while running the suite

A direct schema probe of the shared project found that only the Sprint 1
identity tables exist. All HOPE business tables and the audit table are absent:

| Object | Hosted state |
|---|---|
| `app_role`, `module`, `rights_catalog`, `app_user`, `user_permission` | present |
| `audit_log` | **missing** (`PGRST205`) |
| `customer`, `product`, `pricehist` | **missing** (`PGRST205`) |
| `sales`, `salesdetail`, `payment` | **missing** (`PGRST205`) |
| `employee`, `department`, `job`, `jobhistory` | **missing** (`PGRST205`) |
| `set_user_rights(uuid, integer[])` | **missing** from the schema cache |

Consequences:

- `audit_log` is missing, so no rights change, login or user-management action
  can be verified as audited on hosted.
- Every Sprint 2 customer/product screen and test depends on tables that do not
  exist in the hosted environment. Sprint 2 verification cannot start there
  until `20261118_hope_base_tables_and_sample_data.sql` is applied.

This is D3 in the defect log and the main Sprint 3 entry blocker in
`docs/s2-sm-05-sprint-2-review-retrospective.md`.

## Link delivery and password-reset completion

The task asks for real link delivery and completion, not an API status code.

| Flow | What was actually observed | Delivery evidence |
|---|---|---|
| Registration | `POST /api/auth/register` returns `201` and the account is created with `email_confirm: true`; no confirmation email is sent by design | No email involved |
| Reset request | `POST /api/auth/reset/request` returns `200` and stores a hashed, unused token with a future expiry; the token itself was read from the database to complete the flow | **Not verified** - no mailbox, no SMTP/provider log, no click on a real link |
| Reset completion | Full token flow passes 22/22, including expiry, reuse and revocation, using the stored token | Link *resolution* by email **not verified** |

The reset request endpoint returning a success status is only an acknowledgement
that the request was accepted. It is **not** proof that an email was delivered,
that the link resolved, or that the password was changed by clicking the link.
Claiming a pass here would repeat the exact mistake #131 warns about, so the
runner deliberately completes the flow with the stored token instead.

To close this item, a tester with access to a real inbox must:

1. request a reset for that inbox,
2. open the received link,
3. set a new password,
4. sign in with the new password, and
5. attach the timestamped email and the resulting success screen.

Status: **BLOCKED - no accessible mailbox or provider delivery log**.

## Verdict

- Sprint 1 functional behaviour: **PASS** on 6 of 8 areas, with 3 failing
  checks explained above (2 test-fixture, 1 deployment gap).
- Sprint 1 hosted readiness: **NOT READY**. The hosted project is missing the
  audit table, the rights RPC, and all HOPE business tables.
- Reset-password link delivery: **BLOCKED**, no delivery evidence.

## How to re-run

```powershell
$env:APP_ORIGIN = "http://localhost:3001"
npm.cmd run dev -- -p 3001          # separate terminal
node --env-file=.env.local scripts/verify-registration.mjs
node --env-file=.env.local scripts/verify-auth.mjs
node --env-file=.env.local scripts/verify-user-management.mjs
node --env-file=.env.local scripts/verify-user-approval.mjs
node --env-file=.env.local scripts/verify-user-rights.mjs
node --env-file=.env.local scripts/verify-seed.mjs
node --env-file=.env.local scripts/smoke-login-dashboard.mjs
```

The rights path also has a database-level regression test that runs without
hosted access:

```powershell
# after applying the migrations + supabase/seed.sql to a scratch Postgres
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 `
  -f supabase/tests/s1_dev_07_user_rights_audit_test.sql
```

## Follow-ups

| Action | Owner | Blocks |
|---|---|---|
| Push migrations + seed to the hosted project | DBA (BATOTS2007) | D1, D3, all Sprint 2 hosted tests |
| Make the superadmin guards data-aware in the runners | Tester (stfnviernes-afk) | D2 |
| Capture real reset-link delivery | Tester (stfnviernes-afk) | Reset-password sign-off |
