# Supabase team setup

This project uses the team's hosted Supabase project. Docker and a local Supabase stack are not required.

## Prerequisites

- Node.js 20 or newer
- Access to the team's Supabase project

## First-time setup

From the repository root:

1. Sign in to the Supabase CLI:

   ```powershell
   npx --yes supabase@latest login
   ```

2. Link this checkout to the team project. Get the Reference ID from **Project Settings → General** in the Supabase dashboard:

   ```powershell
   npx --yes supabase@latest link --project-ref YOUR_PROJECT_REF
   ```

   Replace `YOUR_PROJECT_REF` with the actual Reference ID. Enter the database password only in the terminal if prompted.

## Pushing migrations

Only push migrations after the team has reviewed and approved them. This changes the hosted database.

On macOS/Linux or in Git Bash on Windows, from the repository root:

```bash
bash scripts/db-push.sh
```

In PowerShell, run the equivalent CLI command directly:

```powershell
npx --yes supabase@latest db push --remote
```

Both commands change the hosted database. Do not run them until migrations have been reviewed and approved.

Never commit access tokens, database passwords, or other credentials.

## Running the database tests

The SQL tests in `supabase/tests/` are self-verifying: each one runs inside a
transaction that is rolled back, prints PASS/FAIL per case, and raises an
exception if anything failed.

Open the **SQL Editor** in the Supabase dashboard, paste the file, and press
**Run**. To run it from a terminal instead, use any Postgres client with the
database connection string:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s1_dba_06_audit_user_test.sql
```

| Test file | Covers |
|---|---|
| `s1_dba_06_audit_user_test.sql` | `audit_user()` / `audit_log.action_by` record the logged-in user (S1-DBA-06) |

## How the audit trail identifies the user

`audit_user()` is the single place that decides who gets written to
`audit_log.action_by` and to the `stamp` column. It resolves, in order:

1. `app.username`, but only for trusted SQL sessions (never for the `anon` or
   `authenticated` API roles, so a browser client cannot spoof the actor).
2. `app_user.username` for the JWT subject, once that table exists.
3. The JWT `email` claim of the logged-in Supabase Auth user.
4. The JWT `sub` claim (the auth user id).
5. `session_user`, for psql, migrations, and the service role.

The result is capped at 50 characters to fit `audit_log.action_by`.