# S1-DEV-07 — Rights Dialog Verification Evidence

## Scope

Implemented the per-user module rights dialog for active, unblocked standard User accounts.

- Modules: Customer, Product, Human Resources, Sales, and Reports.
- Per-action rights: 3, 6, 13, 7, and 7 (36 total).
- Module checkboxes support All/None and tri-state selected counts.
- Admin and Superadmin can open rights for eligible standard users.
- Every INSERT, soft revoke, and restore in `public.user_permission` writes `public.audit_log`.
- The API rejects unauthenticated, standard-user, hidden Admin/Superadmin targets, blocked/pending targets, and unknown right ids.

## Implementation files

- `app/users/RightsDialog.tsx`
- `app/users/page.tsx`
- `app/users/Users.module.css`
- `app/api/users/[id]/rights/route.ts`
- `supabase/migrations/20261121130000_user_rights_audit_and_rpc.sql`
- `scripts/verify-user-rights.mjs`
- `package.json` (`verify:rights`)

## Automated verification

With a running local Next.js server and `.env.local` configured:

```powershell
npm run verify:rights
```

The script creates temporary Superadmin, Admin, and standard User accounts, exercises the browser API as each role, verifies the five-module catalogue and exact 36-action counts, grants and revokes Customer rights, verifies ADD/DELETE/RESTORE audit rows and actor identity, rejects unknown rights, and cleans up all temporary auth users.

## Narrow static checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Delivery checklist

- [ ] `verify:rights` passes against the configured local Supabase project. (Not runnable here: `.env.local` contains placeholder Supabase values.)
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [ ] Migration is applied to local Supabase before running the verification script.
