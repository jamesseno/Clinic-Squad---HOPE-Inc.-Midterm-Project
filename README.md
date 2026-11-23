# Clinic Squad — HOPE Inc. ERP

The **HOPE Inc. ERP web application**, built by Clinic Squad for our midterm project. It pairs a modern Next.js front end with Supabase (Postgres + Auth) and enforces per-user, per-action access rights rather than blunt role checks.

---

## What the app does

| Area | Screen | What you can do |
| --- | --- | --- |
| Accounts | `/` (sign in), `/register-evidence`, `/set-password` | Register, sign in, set a first password, reset a forgotten password |
| Overview | `/dashboard` | See your profile, role, module list, and live user counts |
| Customer | `/customers` | Search, filter, add, edit, soft-delete, and restore customers |
| Product | `/products` | Search, filter, add, edit, soft-delete, and restore products; view and manage dated price history and the price as of any date |
| Administration | `/users` | Approve pending accounts, block/unblock users, assign per-user rights |

Every customer, product, and price action is checked against the signed-in user's effective rights (role grants plus per-user grants) on the server **and** enforced again by Postgres Row Level Security.

## Tech stack

- **Next.js 16** (App Router, Turbopack) with **React 19** and TypeScript
- **Supabase**: Postgres, Auth, and Row Level Security
- CSS Modules, no UI framework
- Node.js 20.9 or newer

---

## Getting started

### Requirements

- Node.js 20.9 or newer and npm
- Access to the team's Supabase project

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env.local` and fill in the values:

```powershell
Copy-Item .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe for the browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (safe for the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Used by trusted scripts and the verification suite. Never expose it in a `NEXT_PUBLIC_` variable |
| `APP_ORIGIN` | Origin used for auth redirects, e.g. `http://localhost:3000` |

`.env.local` is git-ignored. Never commit keys.

### 3. Prepare the database

Migrations and the seed file live in `supabase/`. They must be applied in timestamp order, followed by `supabase/seed.sql`. Full instructions, including the hosted-project workflow and the SQL Editor route, are in [`supabase/README.md`](./supabase/README.md).

Quick check that the catalogue is correct without touching a database:

```powershell
npm run verify:seed
```

### 4. Run the app

```powershell
npm run dev
```

Open <http://localhost:3000>. Supabase client helpers live in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server); `proxy.ts` refreshes Auth sessions on every request.

---

## Roles and rights

Three roles ship by default:

| Role | Default rights |
| --- | --- |
| `superadmin` | All 36 rights across all five modules |
| `admin` | All 9 Customer, Product, and Price rights |
| `user` | No module rights until an administrator grants them |

Rights are stored in `rights_catalog` (36 codes across Customer, Product, Human Resources, Sales, and Reports), granted to roles through `role_permission`, and granted to individual users through `user_permission`. Effective access is the union of both, so an administrator can extend a user's access without changing their role. The Rights dialog at `/users` manages the per-user grants and records every change in `audit_log`.

Customer rights: `add_customer`, `edit_customer`, `delete_customer`.
Product rights: `add_product`, `edit_product`, `delete_product`, `add_price`, `edit_price`, `delete_price`.

---

## API overview

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create an Auth user plus a pending `app_user` profile |
| `POST /api/auth/login` / `POST /api/auth/logout` | Start and end a session |
| `GET /api/auth/session` | Current active, unblocked user |
| `POST /api/auth/set-password` | Set a first password after an invitation |
| `POST /api/auth/reset/request`, `GET /api/auth/reset/verify`, `POST /api/auth/reset/confirm` | Single-use, hashed password reset flow |
| `GET /api/dashboard` | Profile, role, modules, and counts |
| `GET/POST /api/customers` | List/search customers; create one |
| `GET/PATCH/DELETE/POST /api/customers/[custno]` | Read, edit, soft-delete, and restore a customer |
| `GET/POST /api/products` | List/search products with price as of a date; create one |
| `GET/PATCH/DELETE/POST /api/products/[prodcode]` | Read, edit, soft-delete, and restore a product |
| `GET/POST /api/products/[prodcode]/prices` | Price history; add a price |
| `PATCH/DELETE/POST /api/products/[prodcode]/prices/[effdate]` | Edit, soft-delete, and restore a price entry |
| `GET/POST /api/users`, `GET/PATCH /api/users/[id]` | User administration |
| `POST /api/users/[id]/approve`, `/status`, `/rights` | Approval, block/unblock, and per-user rights |

All data routes return `Cache-Control: no-store`, reject unauthenticated callers with `401`, reject missing rights with `403`, and return `503` with a clear message when the database is missing the business tables (an unmigrated environment).

### Soft delete

Customers, products, and prices are never hard-deleted. Deleting sets `is_deleted = true`; `*_active` views expose only live rows. Deleted rows are hidden from lists unless the caller holds the matching delete right and asks for `includeDeleted=true`, and they can be restored from the same screen. A database guard blocks deleting a record that still has active child records (for example, a product with sales lines).

### Price history

Prices are stored per product and effective date. The products list shows the price as of the selected date, and `product_price_as_of(prodcode, date)` resolves the same value in SQL for reports.

---

## Checks and verification

```powershell
npm run lint
npm run typecheck
npm run build
```

With the dev server running and `.env.local` configured:

| Command | Verifies |
| --- | --- |
| `npm run verify:seed` | Roles, modules, and the 36-right catalogue (offline) |
| `npm run verify:registration` | Registration and pending-account rules |
| `npm run verify:auth` | Login, logout, session, blocked/pending denial, first password |
| `npm run verify:reset` | Password reset request/verify/confirm, expiry, reuse |
| `npm run verify:users` | User listing and profile updates |
| `npm run verify:approval` | Approval and block/unblock rules |
| `npm run verify:rights` | Per-user rights assignment and audit |
| `npm run test:smoke` | Sign-in through the dashboard and module access |

Database tests in `supabase/tests/` are self-verifying: each runs inside a transaction that is rolled back, prints PASS/FAIL per case, and raises on failure. Run them from the Supabase SQL Editor or with `psql`. See [`supabase/README.md`](./supabase/README.md#running-the-database-tests).

---

## Project structure

```
app/                 App Router pages and API routes
  api/               Auth, dashboard, customers, products, users endpoints
  customers/         Customer workspace
  products/          Product workspace
  users/             User administration
components/          Shared client components (workspace shell, modals)
lib/                 Supabase clients, access checks, validation, helpers
supabase/            Migrations, seed, verifier, and SQL tests
scripts/             Verification and provisioning scripts
docs/                Sprint documentation, test evidence, and issue records
```

---

## Documentation

- [`supabase/README.md`](./supabase/README.md) — migrations, seed, hosted setup, SQL tests
- [`docs/testing/`](./docs/testing) — test plans, cases, regression results, and defect reports
- [`docs/sprint2/`](./docs/sprint2) — Sprint 2 issue records and implementation evidence
- [`docs/Team Agreement.md`](./docs/Team%20Agreement.md) — team working agreement
