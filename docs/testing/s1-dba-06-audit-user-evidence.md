# S1-DBA-06 — `audit_user()` records the logged-in user

| | |
|---|---|
| Issue | [#24](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/24) |
| Branch | `feat/s1-dba-06-audit-user-jwt` |
| Migration | `supabase/migrations/20261121_audit_user_jwt_actor.sql` |
| Test | `supabase/tests/s1_dba_06_audit_user_test.sql` |

## The problem

`audit_user()` only read the `app.username` setting and then fell back to
`session_user`. Nothing ever set `app.username`, and through Supabase every
request arrives on the same database role, so `audit_log.action_by` recorded
`authenticated` (or the connection user) instead of the person using the app.

Reproduced on a fresh database with only the base migration applied, sending a
request JWT for `before.fix@hope.example`:

```
audit_log.action_by = "postgres"        <- the database login
session_user        = "postgres"
```

## The change

`audit_user()` now resolves the actor from the JWT that Supabase/PostgREST
already verifies, first match wins:

1. `app.username` — explicit override, **only** for trusted SQL sessions
   (`anon` and `authenticated` are excluded, so a browser client cannot forge
   the audit trail).
2. `app_user.username` for the JWT subject, once the S1-DBA-03 table exists
   (RLS shows a user their own row, which is the row being looked up).
3. The JWT `email` claim — the logged-in Supabase Auth user.
4. The JWT `sub` claim — the auth user id.
5. `session_user` — psql, migrations, service role without a JWT.

The value is capped at 50 characters to fit `audit_log.action_by`.

While testing it, a second bug surfaced: `stamp` was `VARCHAR(60)`, but
`'RESTORE ' + actor + ' ' + 'YYYY-MM-DD HH12:MI AM'` needs up to 78 characters.
Once the actor is an email address, an ordinary write would have failed with
`value too long for type character varying(60)`. The migration widens `stamp`
to `VARCHAR(100)` and caps the actor inside `audit_stamp()` at 50.

| File | What it does |
|---|---|
| `supabase/migrations/20261121_audit_user_jwt_actor.sql` | New `audit_user()`, capped `audit_stamp()`, `stamp` widened on all 10 tables |
| `supabase/tests/s1_dba_06_audit_user_test.sql` | 11 self-verifying cases, rolled back, exits non-zero on failure |
| `supabase/README.md` | How to run the tests and how the actor is resolved |

## How it was verified

* PostgreSQL **18.7**, fresh cluster (`embedded-postgres`, Windows, no Docker).
* Base migration `20261118_hope_base_tables_and_sample_data.sql` applied first,
  then the new migration, then the test file.
* The shared Supabase project was **not** touched: the base migration drops and
  recreates every table, so it must never be replayed against the team database
  just to run a test.

### Before → after, same JWT

```
=== BEFORE fix ===
audit_log.action_by = "postgres"                      (JWT: before.fix@hope.example)
=== AFTER fix ===
audit_log.action_by = "after.fix@hope.example"
department.stamp    = "ADD after.fix@hope.example 2026-11-21 09:34 PM"
```

### Test suite — 11/11 passed

| # | Case | Observed |
|---|---|---|
| T1 | Falls back to the database login when no user is supplied | `audit_user()=postgres` |
| T2 | Explicit `app.username` override is honoured for trusted sessions | `qa.explicit` |
| T3 | JWT email is used for the logged-in user | `qa.user@hope.example` |
| T4 | JWT `sub` is used when the token carries no email | `22222222-…-222222222222` |
| T5 | Older `request.jwt.claim.email` setting is still honoured | `legacy.claim@hope.example` |
| T6 | Trigger records the logged-in user in `audit_log.action_by` | `qa.trigger@hope.example` |
| T7 | `stamp` column also carries the logged-in user | `ADD qa.trigger@hope.example 2026-11-21 09:34 PM` |
| T8 | Actor longer than 50 chars is truncated and the write still succeeds | 50 chars, `very.long.audit.identity.address.for.testing@hope.` |
| T9 | Public API roles cannot spoof `app.username` | as `authenticated`: `postgres`, not `spoofed.by.client` |
| T10 | `audit_user()` never returns NULL or a blank actor | `postgres` |
| T11 | `stamp` stays within `VARCHAR(100)` with a very long actor | length 75 |

```
NOTICE: S1-DBA-06: all 11 tests passed
```

### Other checks

* **Idempotent** — the migration was applied twice in a row with no error.
* **`app_user` mapping** — with a simulated `app_user(id, username)` row, the
  same request returned `hope.admin` in both `audit_user()` and
  `audit_log.action_by`, confirming the S1-DBA-03 branch works.
* **Column widths** — `audit_log.action_by = varchar(50)` (unchanged),
  `stamp = varchar(100)` (widened).
* **Read views** — the 10 `<table>_active` views were dropped and recreated to
  allow the `stamp` widening; all still return rows and still filter
  `NOT is_deleted`:

  | View | Rows | View | Rows |
  |---|---|---|---|
  | `employee_active` | 32 | `customer_active` | 82 |
  | `department_active` | 8 | `sales_active` | 124 |
  | `job_active` | 14 | `salesdetail_active` | 313 |
  | `jobhistory_active` | 54 | `product_active` | 57 |
  | `payment_active` | 165 | `pricehist_active` | 79 |

## How to re-run

Paste `supabase/tests/s1_dba_06_audit_user_test.sql` into the Supabase SQL
Editor and press Run, or:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s1_dba_06_audit_user_test.sql
```

The script runs in one transaction and rolls back, so it leaves no rows behind.

## After merge

The migration still has to be pushed to the hosted project, after review:

```powershell
npx --yes supabase@latest db push --remote
```

## Notes and limits

* `app.username` is deliberately unavailable to `anon`/`authenticated`. A
  client-callable setter would be an audit-trail forgery vector.
* The `app_user.username` lookup depends on RLS letting a user read their own
  row. If that policy is missing, the audit trail falls back to the email, which
  is still the correct person.
* `audit_log.action_by` remains `VARCHAR(50)`, so an unusually long email is
  truncated there. The `stamp` column keeps a separate 50-character cap.
