-- Read-only checks for S1-DEV-03. Safe to paste into the Supabase SQL Editor.

SELECT
    has_schema_privilege('service_role', 'app_private', 'USAGE') AS service_role_can_use_app_private,
    has_function_privilege(
        'service_role',
        'app_private.guard_app_user_update()',
        'EXECUTE'
    ) AS service_role_can_run_update_trigger;

SELECT
    p.proname AS function_name,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'app_private'
ORDER BY p.proname;

SELECT
    email,
    account_status,
    is_blocked
FROM public.app_user
WHERE is_blocked
   OR account_status <> 'active'
ORDER BY email;
