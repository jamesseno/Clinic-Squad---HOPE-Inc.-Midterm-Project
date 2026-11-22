# S2-TST-06 Defect reports and fix verification

Related issue: #132

Defects found while running the Sprint 1 regression suite (#131) and the hosted
schema probe on 2026-11-22 against `main` at `a159297`.

Every entry has a reproduction, expected versus actual behaviour, severity,
evidence, the tasks it affects, and the verification that closes it. Nothing is
marked fixed without a re-run.

## Summary

| ID | Title | Severity | Status | Affects |
|---|---|---|---|---|
| D1 | Rights save fails with HTTP 500 on hosted (`set_user_rights` missing) | High | Open - deployment | #26, #107, #117, #127, #130 |
| D2 | Superadmin protection checks assume exclusive ownership of the role | Medium | Open - test fixture | #131, S1-DEV-04, S1-DEV-05 |
| D3 | Hosted project is missing `audit_log` and all HOPE business tables | Critical | Open - deployment | #105, #107, #110-#113, #115, #117, #119-#121, #123, #124, #126-#128, #130 |
| D4 | First cold-compile login request returned HTTP 500, then passed | Low | Closed - not reproducible | #131 |
| D5 | Dead rights-dialog state left in the users page after PR #145 | Low | Fixed - verified | #26, #107 |

---

## D1 - Rights save fails with HTTP 500 on hosted

**Severity:** High (feature is unusable in the hosted environment)
**Status:** Open - blocked on a migration push
**Affects:** #26 (S1-DEV-07), #107, #117, #127, #130

### Environment

- `main` at `a159297`
- Local app on `http://localhost:3001`
- Shared hosted Supabase project from `.env.local`

### Reproduction

1. Sign in as an Admin or Superadmin.
2. Open **Users**, pick an active standard User, click **Rights**.
3. Tick the three Customer rights.
4. Click **Save**.

Or run:

```powershell
$env:APP_ORIGIN = "http://localhost:3001"
node --env-file=.env.local scripts/verify-user-rights.mjs
```

### Expected

`PUT /api/users/<id>/rights` returns `200`, the three rows appear in
`user_permission`, and three `ADD` rows appear in `audit_log`.

### Actual

```text
Rights update failed: Could not find the function
public.set_user_rights(p_right_ids, p_user_id) in the schema cache
PUT /api/users/<id>/rights 500 in 1720ms
```

Response body: `{"error":"Could not save the selected rights."}`

The dialog still loads: all eight read-side checks pass (401/403 gates,
catalogue shape 3/6/13/7/7, three Customer rights). Only the write fails.

### Root cause

Migration `supabase/migrations/20261121130000_user_rights_audit_and_rpc.sql`
is merged in `main` but was never applied to the hosted project. The REST schema
cache has no `set_user_rights`, so PostgREST rejects the RPC call.

### Fix

1. Apply the pending migrations to the hosted project (reviewed first):
   `npx supabase db push --remote`
2. Confirm the RPC is visible: `set_user_rights` appears in the OpenAPI schema.
3. Re-run `verify-user-rights.mjs`.

### Verification of the fix

Not yet verified on hosted - the migration push has not happened. The SQL
layer is proven independently by
`supabase/tests/s1_dev_07_user_rights_audit_test.sql`, which passes 14/14
against a scratch Postgres with the migrations and `seed.sql` applied
(including grant, revoke, restore, clear, role guards and audit attribution).
That isolates the failure to deployment, not code.

---

## D2 - Superadmin protection checks assume exclusive ownership of the role

**Severity:** Medium (verification reliability, not product behaviour)
**Status:** Open - test fixture
**Affects:** #131, S1-DEV-04, S1-DEV-05

### Environment

Same as D1. The shared hosted project contains a real active Superadmin
(`senomj6@gmail.com`) in addition to the throwaway one each runner creates.

### Reproduction

```powershell
node --env-file=.env.local scripts/verify-user-management.mjs   # fails at check 27
node --env-file=.env.local scripts/verify-user-approval.mjs     # fails at check 11
```

### Expected

- Blocking the runner's Superadmin returns `409` ("last active superadmin").
- The runner's Superadmin row is returned with `protected: true`.

### Actual

```text
✓ unblocked user can sign in again (HTTP 200)
Error: FAILED: last active superadmin cannot be blocked (HTTP 409)
```

```text
✓ superadmin can open user management (HTTP 200)
Error: FAILED: last active superadmin row is marked protected
```

The block succeeds with `200` and `protected` is `false`.

### Root cause

`getLastActiveSuperadminId()` in `lib/user-management.ts` returns an id only
when exactly one active, unblocked Superadmin exists. With two, it returns
`null` and the guard correctly does not apply. The product is behaving as
designed; the runners assume they own the only Superadmin in the database.

### Fix

Make the assertions data-aware instead of assuming exclusivity:

- Before the block check, count active unblocked Superadmins.
- If the count is greater than one, assert `200` and that the account is
  blocked; if it is exactly one, assert `409`.
- For `protected`, assert `protected === true` only when the count is one, and
  assert no row is protected otherwise.

Alternatively run these two runners against an isolated project.

### Verification of the fix

Not yet applied. When applied, re-run both runners on the shared project and
attach the new logs to this issue.

---

## D3 - Hosted project is missing `audit_log` and all HOPE business tables

**Severity:** Critical (blocks all Sprint 2 delivery and verification on hosted)
**Status:** Open - deployment
**Affects:** #105, #107, #110, #111, #112, #113, #115, #117, #118, #119, #120,
#121, #123, #124, #126, #127, #128, #130

### Reproduction

```javascript
// with service-role credentials
const { data, error } = await admin.from("customer").select("*").limit(1);
// error.code === "PGRST205"
// "Could not find the table 'public.customer' in the schema cache"
```

### Expected

The hosted project contains the tables created by
`20261118_hope_base_tables_and_sample_data.sql` plus `audit_log`, so customer
and product work can be built and tested.

### Actual

| Object | Hosted |
|---|---|
| `app_role`, `module`, `rights_catalog`, `app_user`, `user_permission` | present |
| `audit_log` | missing |
| `customer`, `product`, `pricehist` | missing |
| `sales`, `salesdetail`, `payment` | missing |
| `employee`, `department`, `job`, `jobhistory` | missing |

`verify-seed.mjs` passes because it only reads the identity tables.

### Root cause

The Sprint 1 auth/user-management migrations were applied to the hosted project,
but the HOPE base-table migration was not. The hosted project is therefore a
partial schema: identity works, business data does not, and nothing is audited.

### Fix

Apply the reviewed migrations and seed to the hosted project, then re-probe:

```powershell
npx supabase db push --remote
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/verify-seed.sql
```

### Verification of the fix

Not yet verified. Acceptance: the probe returns a row count (not `PGRST205`) for
all eleven tables, and one user-management action writes an `audit_log` row.

---

## D4 - First cold-compile login request returned HTTP 500, then passed

**Severity:** Low (harness artifact, no product impact)
**Status:** Closed - not reproducible
**Affects:** #131

### Reproduction

1. Start `next dev` on a clean `.next` directory.
2. Immediately `POST /api/auth/login` with a server-controlled field
   (`account_status`).

### Expected

`400` with "Field(s) account_status cannot be set during login."

### Actual

First attempt returned `500 Internal Server Error` while Turbopack was still
compiling. The same request returned `400` on the next run, and
`verify-auth.mjs` passed 24/24 afterwards.

### Root cause

Dev-server compile race, not application logic. `lib/auth-validation.ts`
rejects unknown keys before any database call, so the route cannot legitimately
return `500` for this payload once compiled.

### Verification

Re-ran `verify-auth.mjs` after warm-up: 24/24 pass. Logged here so a future
tester does not chase it as a regression. No code change.

---

## D5 - Dead rights-dialog state left in the users page after PR #145

**Severity:** Low (code hygiene, no runtime effect)
**Status:** Fixed - verified
**Affects:** #26, #107

### Reproduction

```powershell
npm.cmd run lint
```

### Expected

No unused-variable warnings.

### Actual

```text
app/users/page.tsx
  73:10  warning  'rightsDialogUser' is assigned a value but never used
 295:12  warning  'openRightsDialog' is defined but never used
```

### Root cause

PR #145 introduced a `rightsDialogUser` state value and an `openRightsDialog`
helper, then routed the actual dialog through `modal.mode === "rights"`. The
first implementation was left behind.

### Fix

Delete the unused `rightsDialogUser` state and the `openRightsDialog` function
from `app/users/page.tsx`. The dialog keeps working through
`openRights(user)` and `modal`.

### Verification of the fix

Applied in this PR: the unused `rightsDialogUser` state and the unused
`openRightsDialog` helper were deleted from `app/users/page.tsx`. The dialog
still opens through `openRights(user)`, which sets `modal.mode = "rights"`.

Re-run after the change:

```text
npm.cmd run lint      -> 0 errors, 1 warning (app/layout.tsx custom font, pre-existing)
npm.cmd run typecheck -> exit 0
```

Both `app/users/page.tsx` warnings are gone and no new warning appeared.

---

## Fix verification log

| Defect | Fix | Verified by | Result |
|---|---|---|---|
| D1 | Push migration + seed to hosted | `verify-user-rights.mjs` | **Blocked** - not pushed |
| D2 | Data-aware superadmin assertions | Re-run both runners | **Not applied** |
| D3 | Push base migration + seed | 11-table probe + audit row | **Blocked** - not pushed |
| D4 | None needed | `verify-auth.mjs` re-run | **Verified** - 24/24 |
| D5 | Remove dead state | `npm run lint` / `typecheck` | **Verified** - 0 errors, users-page warnings gone |

No defect is marked fixed on the strength of a code merge alone; each requires
the re-run named above.
