# S1-DBA-05 verification notes

Branch: `dbadmin`
Date: 2026-11-21

## What was checked locally

These checks require no database connection, credentials, roster, or email delivery.

| Check | Command | Result |
| --- | --- | --- |
| Seed catalogue invariants | `npm run verify:seed` | PASS — 3 roles, 5 modules, 36 rights (3/6/13/7/7); grants: Superadmin 36, Admin 0, User 0 |
| TypeScript build surface | `npm run typecheck` | PASS — no output/errors |
| Invitation script syntax | `node --check scripts/invite-superadmins.mjs` | PASS — no output/errors |
| Diff whitespace | `git diff --check` | PASS — no output/errors |

`npm run verify:seed` also confirms the exact guide section 3.8 action names and labels (Customer 3, Product 6, Human Resources 13, Sales 7, Reports 7), that `supabase/seed.sql` contains no team email addresses or password/token/service-role/API-key material, and that it prunes stale non-Superadmin default grants on rerun.

## Guide reconciliation

The authoritative catalogue was read from `HOPE_Sprint_1_From_Scratch_Guide.pdf`, section 3.8 (printed pages 12-13). The provisional generic actions (`view`, `create`, `update`, `delete`, `import`, `export`, `restore`, `print`, `schedule`, `share`) were replaced with the guide's exact 36 per-action rights. The guide does not define a default Admin/User role matrix, so the seed grants all 36 rights only to Superadmin and leaves Admin/User module rights to be granted per user.

## What still requires an authorized operator

The following were deliberately not performed in this code change:

1. No database migration, seed application, or `db reset` was run against any project.
2. `supabase/verify-seed.sql` was not executed against a hosted database. Run it with `psql` against an authorized non-production database after migrations and seed; it fails loudly on catalogue or role-matrix drift and prints profile counts for roster review.
3. No invitation was sent and no Auth account was created. The approved roster must be supplied at runtime to `scripts/invite-superadmins.mjs`; it is not stored in the repository.
4. Superadmin profile counts must be compared manually with the approved team roster after invitations. The issue's "one account per team member" item cannot be evidenced from source control alone.
5. The Superadmin-only default role matrix is a documented assumption because guide 3.8 does not enumerate role-to-right defaults; team confirmation is still needed.
6. PR approval and merge are repository workflow steps and were not performed here.

## Security posture

- Passwords are not stored in seed data or source control.
- Initial account setup uses a Supabase Auth one-time invitation link; the recipient sets a password at `/set-password` via `/auth/callback`.
- The service-role key is read only by the local Node invitation process from environment configuration and is never printed or returned to the browser.
- `supabase/verify-seed.sql` is read-only apart from raising exceptions; it does not modify application data.
