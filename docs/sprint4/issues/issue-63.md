# S4-SM-03: Release checklist and demo script

Issue: #63
Owner: `jamesseno`
Target: Sprint 4, day 8

## Release checklist

- [ ] All 30 Sprint 4 issues link to one issue-scoped PR and preserve the original issue assignee.
- [ ] Each PR has a teammate review, passing required checks, and a recorded merge state.
- [ ] `README` setup and recovery instructions match the final migration sequence.
- [ ] Approved non-production Supabase project rebuilt from migrations; RLS and rollback-safe database tests pass.
- [ ] Login, invitations, reset links, redirects, SMTP behavior, and role assignment tested with non-production accounts.
- [ ] Rights are enforced at both API and database layers; direct requests are tested for unauthorized access.
- [ ] Sales, sale-date pricing, Payments, balances, Reports, and Audit are covered by role-based E2E and regression suites.
- [ ] Backup and restore/rebuild evidence is available without using production data.
- [ ] No unresolved critical security, authorization, privacy, or data-integrity issue is called complete.

## Demo sequence

1. Sign in as a least-privileged user and show only authorized modules/actions.
2. Demonstrate `/sales` search and `/sales/new` using existing Customer, Employee, and Product records (#48).
3. Open `/sales/[transno]`, add a sale line, and show the eligible unit price for the transaction date (#54).
4. Record a payment and show transaction/customer balances reconcile (#57, #61).
5. Open each of the seven report routes under `/reports/[report]` with its required filters/right; show denial for a user lacking the specific right (#58, #60).
6. Open `/audit` as superadmin; verify a non-superadmin is denied the page, API, and underlying data (#70).
7. Demonstrate sale delete/restore and status/stamp without deleting protected child data (#64).
8. Present the automated test results, migration/rebuild evidence, known blockers, and a fallback plan using seeded non-production data.

The PR links for these task IDs are intentionally pending until the issue-specific PRs exist; do not present issue links as PR links.

## Pre-demo gate and fallback

The current environment has no `.env.local` or approved hosted Supabase access, so live auth, SMTP, RLS, migration, and recovery checks are not yet verified. Do not use real patient or production data. If environment setup is unavailable, show local UI/build evidence only, label the demo as incomplete, and retain the release block rather than claiming hosted verification.
