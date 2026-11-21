-- Read-only checks for S1-DEV-04. Safe to paste into the Supabase SQL Editor.

SELECT
    to_regclass('public.password_reset_token') IS NOT NULL AS reset_token_table_exists,
    has_table_privilege('service_role', 'public.password_reset_token', 'SELECT') AS service_role_can_read,
    has_table_privilege('service_role', 'public.password_reset_token', 'INSERT') AS service_role_can_insert,
    has_table_privilege('service_role', 'public.password_reset_token', 'UPDATE') AS service_role_can_update;

SELECT
    count(*) AS unused_reset_tokens,
    count(*) FILTER (WHERE expires_at <= now()) AS expired_unused_tokens
FROM public.password_reset_token
WHERE used = false;

-- Verification users are removed by scripts/verify-reset-password.mjs; this
-- query should return no rows after a clean run.
SELECT email, account_status, is_blocked
FROM public.app_user
WHERE email LIKE 'reset-%@gmail.com'
ORDER BY email;
