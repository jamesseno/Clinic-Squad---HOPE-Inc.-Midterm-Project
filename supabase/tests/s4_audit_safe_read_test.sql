-- Direct database read contract for the Superadmin audit viewer.
-- Run after migrations on an authorized non-production database.
-- Read-only checks; all fixture identities are rolled back.

BEGIN;

DROP TABLE IF EXISTS pg_temp._s4_audit_results;
CREATE TEMP TABLE pg_temp._s4_audit_results (
    id integer PRIMARY KEY,
    test_name text NOT NULL,
    ok boolean NOT NULL,
    detail text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.check_audit(
    p_id integer,
    p_name text,
    p_ok boolean,
    p_detail text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, pg_catalog
AS $$
BEGIN
    INSERT INTO _s4_audit_results (id, test_name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
    SET test_name = EXCLUDED.test_name,
        ok = EXCLUDED.ok,
        detail = EXCLUDED.detail;
END
$$;

INSERT INTO auth.users (id, email) VALUES
    ('eeeeeeee-0000-4000-8000-000000000041', 's4-audit-user@hope.example'),
    ('eeeeeeee-0000-4000-8000-000000000042', 's4-audit-superadmin@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (
    id, email, first_name, last_name, role_id, account_status, is_blocked
)
SELECT v.id, v.email, 'Sprint', v.last_name, r.role_id, 'active', false
FROM (
    VALUES
      ('eeeeeeee-0000-4000-8000-000000000041'::uuid, 's4-audit-user@hope.example', 'User'),
      ('eeeeeeee-0000-4000-8000-000000000042'::uuid, 's4-audit-superadmin@hope.example', 'Superadmin')
) AS v(id, email, last_name)
JOIN public.app_role AS r
  ON r.role_code = CASE
       WHEN v.id = 'eeeeeeee-0000-4000-8000-000000000042'::uuid
       THEN 'superadmin'
       ELSE 'user'
     END
ON CONFLICT (id) DO UPDATE
SET role_id = EXCLUDED.role_id,
    account_status = 'active',
    is_blocked = false;

SELECT pg_temp.check_audit(
    1,
    'Authenticated users cannot select audit JSON snapshots directly',
    NOT has_column_privilege('authenticated', 'public.audit_log', 'old_values', 'SELECT')
    AND NOT has_column_privilege('authenticated', 'public.audit_log', 'new_values', 'SELECT'),
    'Audit snapshots are exposed only by the redacted Superadmin view.'
);

SELECT pg_temp.check_audit(
    2,
    'Authenticated users retain safe audit metadata access',
    has_column_privilege('authenticated', 'public.audit_log', 'audit_id', 'SELECT')
    AND has_column_privilege('authenticated', 'public.audit_log', 'action_at', 'SELECT'),
    'Metadata access remains subject to audit_log row-level security.'
);

SELECT pg_temp.check_audit(
    3,
    'Sensitive JSON keys are removed by the redaction helper',
    app_private.redact_audit_values(
        '{"password":"x","Token_Hash":"y","field":"safe"}'::jsonb
    ) = '{"field":"safe"}'::jsonb,
    'Password and token material must not be returned from audit snapshots.'
);

SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000041","email":"s4-audit-user@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_audit(
    4,
    'Non-Superadmin cannot read audit rows or the audit view',
    (SELECT count(*) FROM public.audit_log) = 0
    AND (SELECT count(*) FROM public.audit_log_superadmin) = 0,
    'Neither metadata rows nor redacted snapshots are visible to a standard user.'
);
RESET ROLE;

SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000042","email":"s4-audit-superadmin@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_audit(
    5,
    'Superadmin can query the filtered audit view',
    app_private.current_role_code() = 'superadmin'
    AND app_private.has_right('view_audit_log')
    AND has_table_privilege('authenticated', 'public.audit_log_superadmin', 'SELECT'),
    'The view exposes actor/action/table/time filters and deterministic audit ordering.'
);
RESET ROLE;

SELECT id, test_name, ok, detail
FROM pg_temp._s4_audit_results
ORDER BY id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_temp._s4_audit_results
        WHERE NOT ok
    ) THEN
        RAISE EXCEPTION 'Audit read-contract regression test failed.';
    END IF;
END
$$;

ROLLBACK;
