# Project Copilot Instructions

- Tech stack: Next.js App Router, Tailwind CSS, Supabase Auth, and Supabase Database.
- User roles: `superadmin`, `admin`, and `user`.
- Development signup default: use `superadmin` only in isolated development environments when the project explicitly needs it. Never trust a role supplied by the browser or expose service-role credentials to clients; production role assignment must be controlled by trusted server-side logic.
- Security: enable Row Level Security (RLS) on every Supabase table and ensure policies enforce the intended access rules.
- Git: do not commit directly to `main`. Create a focused feature branch and use a pull request for changes.
- Follow the repository's existing conventions and verify changes with the narrowest relevant tests or checks.