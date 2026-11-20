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

Role, module, and right catalogue records are provided by a separate seed migration. Review migrations before applying them to the shared Supabase project.

To apply and verify all migrations against a local Supabase database, start the local stack and reset its database from the repository root:

```powershell
npx --yes supabase@latest start
npx --yes supabase@latest db reset
```

`db reset` is destructive to the local database and reapplies every migration. It requires Docker; it does not change the hosted team project.

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