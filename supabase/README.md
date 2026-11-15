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