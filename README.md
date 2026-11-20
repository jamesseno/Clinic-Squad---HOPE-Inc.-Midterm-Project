# Clinic-Squad---HOPE-Inc.-Midterm-Project


# Clinic Squad - HOPE Inc. Midterm Project

This repository contains the **HOPE Inc. ERP web application**, built as part of our midterm project. It is designed with a modern, scalable tech stack focusing on secure data handling, clean UI design, and robust role-based access control.

---

## Project Overview

Hope Inc. is a modern web application engineered to manage users, accounts, and granular access levels within a secure, responsive environment. 

## Application setup

### Requirements

- Node.js 20.9 or newer
- npm
- Access to the team's Supabase project

### Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and public anon/publishable key. These values are safe for browser use; never put a service-role key in a `NEXT_PUBLIC_` variable.

3. Start the development server:

   ```powershell
   npm run dev
   ```

The app is available at <http://localhost:3000>. Supabase client helpers are provided in `lib/supabase/client.ts` for browser code and `lib/supabase/server.ts` for server code. `proxy.ts` refreshes Supabase Auth sessions. The helpers fail with a clear configuration error if either required environment variable is missing.

### Checks

```powershell
npm run lint
npm run typecheck
npm run build
```

### Registration API

`POST /api/auth/register` creates a Supabase Auth user and a matching
`public.app_user` row. The row always uses the standard `user` role and
`account_status = 'pending'`; those values cannot be supplied by the caller.

Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only) before running the
API or verification script. With the dev server running:

```powershell
npm run verify:registration
```

The script registers a throwaway user, checks the pending status, verifies that
duplicates and unauthorized status changes are rejected, then removes the test
account. Verification evidence for S1-DEV-02 is in
[`docs/dev/s1-dev-02-verification.md`](./docs/dev/s1-dev-02-verification.md).

Database migrations and team Supabase setup instructions are in [`supabase/README.md`](./supabase/README.md). Do not push migrations to the hosted database without team review and approval.
