# Supabase team setup

This project uses the team's hosted Supabase project. Docker and a local Supabase stack are not required.

## Prerequisites

- Node.js 20 or newer
- Access to the team's Supabase project

## Database migrations

Supabase migration files are in `supabase/migrations/` and are applied in timestamp order. The initial migrations establish the HOPE business tables and the access-control schema:

- `20261118_hope_base_tables_and_sample_data.sql` creates the base business tables and sample records.
- `20261119084800_app_user_roles_modules_and_permissions.sql` creates auth-linked user profiles, roles, modules, the rights catalogue, and soft-deletable user permissions. It enables Row Level Security on these tables.
- `20261121002205_password_reset_token.sql` adds server-managed, hashed password reset tokens linked to application users.
- `20261121005600_role_permission_mapping.sql` adds the role-to-right mapping table.
- `20261122130000_sprint2_customer_product_access.sql` adds Customer/Product/Price row-level access policies, action guards, an as-of price lookup, and supporting indexes.
- `20261125090000_s3_employee_current_position.sql` adds a server-only view for each active employee's latest effective job and department; employees without eligible history remain in the result.
- `20261121_audit_user_jwt_actor.sql` attributes audit rows to the signed-in Supabase Auth user.

## Applying everything through the SQL Editor

When the Supabase CLI cannot reach the project (for example, no database
password or access token is available), bundle every migration and the seed into
one file and paste it into the dashboard:

```powershell
npm run db:bundle
```

This writes `supabase/hosted-setup.generated.sql` (git-ignored). Open **SQL
Editor** in the Supabase dashboard, paste the whole file, and run it once
against a project that has no HOPE business tables yet. It applies the
migrations in timestamp order and then the seed. Because the seed converges on
rerun, running the bundle twice is safe for the catalogue, but the base
migration is not idempotent, so do not run it against a database that already
has the business tables.

`seed.sql` is configured as the Supabase seed file. It converges on rerun: it upserts the five core modules, three default roles, and the exact 36-right catalogue, then prunes stale default-role grants. Individual `user_permission` rows are never modified by the seed.

The action names come from the *HOPE Sprint 1 From-Scratch Guide*, section 3.8 (printed pages 12-13): Customer 3, Product 6, Human Resources 13, Sales 7, Reports 7. Sprint 2 grants Admin all 9 Customer, Product, and Price rights as approved for this work; Superadmin retains all 36 rights, and User has no module rights by default. Other module rights can be assigned per user through the Rights dialog.

The supplied guide requires deliberately provisioned team Superadmins and one-time password setup, while keeping public signup behavior a separate decision. The team roster has been supplied separately and should be provided to the trusted provisioning script at runtime rather than committed to seed files. Do not put credentials, token values, or service-role keys in seed files or source control.

## Team Superadmin invitations

The repository includes a minimal Next.js invitation callback and password-setting page, plus a trusted, operator-run invitation script. Invitations use Supabase Auth's one-time invite link; the separate `password_reset_token` table is not used for initial account setup. The script uses the service-role key only in the local Node process, sends the invitation via Supabase Auth, and never prints the link or token. It skips any email that already has an Auth user or profile so existing accounts require explicit manual review.

1. Copy `.env.example` to `.env.local` and fill in the project's Supabase URL, anon key, service-role key, and app origin. `.env.local` is ignored by Git. Never use a production service-role key for this workflow unless the team has explicitly approved production provisioning.
2. Apply the reviewed migrations and seed to an authorized non-production project. Set the Supabase Auth **Site URL** to the app origin and add that origin's `/auth/callback` path to the Auth redirect allow list. For local development, `supabase/config.toml` allows localhost and 127.0.0.1 on port 3000.
3. Install dependencies and start the app:

   ```powershell
   npm install
   npm run dev
   ```

4. In a separate PowerShell terminal, set the roster only in the current process and run the invitation script. Replace the illustrative entries with the approved team roster; do not save it in a tracked file:

   ```powershell
   $env:TEAM_SUPERADMINS_JSON = '[{"first_name":"First","last_name":"Member","email":"member@example.com"}]'
   node --env-file=.env.local scripts/invite-superadmins.mjs
   Remove-Item Env:\TEAM_SUPERADMINS_JSON
   ```

5. Supabase Auth emails the one-time invitation link. The recipient opens it, reaches `/auth/callback`, and sets a password at `/set-password`. The link's validity and one-use behavior are managed by Supabase Auth. Configure SMTP and the invite email template in the Supabase project as needed; the default confirmation URL must preserve the redirect URL supplied by the script.

The invitation script sends real emails and creates Auth/profile records. Review the target project and roster before running it. Do not run it against Production merely to test. No invitation has been sent as part of this code change.

To apply and verify all migrations against a local Supabase database, start the local stack and reset its database from the repository root:

```powershell
npx --yes supabase@latest start
npx --yes supabase@latest db reset
```

`db reset` is destructive to the local database and reapplies every migration. It requires Docker; it does not change the hosted team project.

For an authorized non-production database where migrations have already been applied, run the seed from PowerShell with a securely configured `SUPABASE_DB_URL` and `psql` installed:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

Run the read-only database verifier against that same authorized database:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/verify-seed.sql
```

It raises an exception if the roles, modules, 36 module/action pairs, or default role matrix differ from `seed.sql`, then prints profile counts so the Superadmin roster can be compared with the approved team list. The verifier does not modify data or send emails.

You can also inspect the seeded records in the SQL Editor:

```sql
SELECT module_code, module_name
FROM public.module
ORDER BY display_order;

SELECT m.module_name, count(rc.right_id) AS right_count
FROM public.module AS m
LEFT JOIN public.rights_catalog AS rc ON rc.module_id = m.module_id
GROUP BY m.module_id, m.module_name, m.display_order
ORDER BY m.display_order;

SELECT r.role_code, count(rp.right_id) AS right_count
FROM public.app_role AS r
LEFT JOIN public.role_permission AS rp ON rp.role_id = r.role_id
GROUP BY r.role_code
ORDER BY r.role_code;

SELECT count(*) AS total_rights FROM public.rights_catalog;
```

Expected counts are 36 total rights, 36 for Superadmin, 9 for Admin, and 0 for User by default. Only run this against a database you are authorized to modify; `db push --remote` targets the linked database and can change production.

## Offline verification

The seed catalogue can also be checked without Docker, credentials, or a database:

```powershell
npm install
npm run verify:seed
npm run typecheck
```

`verify:seed` parses `supabase/seed.sql` and confirms the three roles, five modules, 36 rights, Sprint 2 role defaults, absence of roster/credential material, and the presence of stale-grant cleanup. It prints `Sprint 2 seed verification: PASS` when all checks succeed. The S1 verification record captures the earlier seed state.

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
| `s1_dev_07_user_rights_audit_test.sql` | Per-user rights grants, revocations, restores, and their audit rows (S1-DEV-07) |
| `s2_customer_product_access_test.sql` | Customer/Product/Price rights, RLS denial, soft delete and restore, price-as-of (Sprint 2) |
| `s3_employee_current_position_test.sql` | Latest effective employee job/department, future-history exclusion, employees without history, and view grants (Sprint 3) |

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