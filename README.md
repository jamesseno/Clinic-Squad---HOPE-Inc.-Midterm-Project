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

### Authentication API

- `POST /api/auth/login` accepts `{ email, password, remember? }`, verifies that
  the matching `public.app_user` row is active and not blocked, then creates a
  Supabase Auth session in HTTP-only cookies. Pending, blocked, and unknown
  accounts are rejected.
- `GET /api/auth/session` returns the current user only when the Auth session is
  valid and the profile is still active and unblocked. `proxy.ts` applies the
  same rule to every request and clears sessions when a user is blocked.
- `POST /api/auth/logout` ends the session and clears its cookies.
- `POST /api/auth/set-password` requires an active session, validates the new
  password, updates it through Supabase Auth (so it is hashed server-side), and
  clears the one-time `password_setup_required` flag.

With the dev server running:

```powershell
npm run verify:auth
```

The script creates throwaway users, checks login/logout/session behavior,
confirms blocked and pending users are denied, verifies first-password setup,
and removes the test accounts. Verification evidence for S1-DEV-03 is in
[`docs/dev/s1-dev-03-verification.md`](./docs/dev/s1-dev-03-verification.md).

### Password reset API

- `POST /api/auth/reset/request` accepts `{ email }`. Active, unblocked accounts
  receive a single-use token stored only as a SHA-256 hash in
  `public.password_reset_token`; Supabase Auth emails a recovery link containing
  the token. Unknown, pending, and blocked accounts receive the same generic
  response and no token.
- `GET /api/auth/reset/verify?token=...` checks that a token exists, is unused,
  and has not expired.
- `POST /api/auth/reset/confirm` accepts `{ token, password, confirmPassword }`,
  validates the password, updates it through Supabase Auth (so it is hashed
  server-side), and marks the token used. Reused, expired, malformed, and
  unknown tokens are rejected.

The emailed link opens the existing `/set-password` screen; no existing UI file
was changed. With the dev server running:

```powershell
npm run verify:reset
```

The script checks request/verify/confirm behavior, expiry, reuse, revocation by
a newer request, and blocked/pending denial. Verification evidence for
S1-DEV-04 is in [`docs/dev/s1-dev-04-verification.md`](./docs/dev/s1-dev-04-verification.md).

Database migrations and team Supabase setup instructions are in [`supabase/README.md`](./supabase/README.md). Do not push migrations to the hosted database without team review and approval.
