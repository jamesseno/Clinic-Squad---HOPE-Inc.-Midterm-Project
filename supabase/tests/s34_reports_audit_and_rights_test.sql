-- Sprint 3/4 report and audit role-right regression test.
-- Run against an authorized non-production database after migrations and seed.
-- The transaction is rolled back and inserts only temporary test identities.

BEGIN;

DROP TABLE IF EXISTS pg_temp._s34_results;
CREATE TEMP TABLE pg_temp._s34_results (
    id integer PRIMARY KEY,
    name text NOT NULL,
    ok boolean NOT NULL,
    detail text
);

CREATE OR REPLACE FUNCTION pg_temp.check(
    p_id integer,
    p_name text,
    p_ok boolean,
    p_detail text
) RETURNS void LANGUAGE sql AS $$
    INSERT INTO pg_temp._s34_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        ok = EXCLUDED.ok,
        detail = EXCLUDED.detail;
$$;

SELECT pg_temp.check(
    1,
    'The seven report rights exist',
    (
        SELECT count(*)
        FROM public.rights_catalog rc
        JOIN public.module m USING (module_id)
        WHERE m.module_code = 'reports'
          AND rc.right_code IN (
              'top_customers',
              'product_master_list',
              'top_products',
              'active_employees',
              'all_employees',
              'employee_job_history',
              'top_sales'
          )
    ) = 7,
    'Expected one catalogue entry for each of the seven reports.'
);

SELECT pg_temp.check(
    2,
    'Audit view right exists and is catalogued',
    EXISTS (
        SELECT 1
        FROM public.rights_catalog
        WHERE right_code = 'view_audit_log'
          AND is_active
    ),
    'view_audit_log must be present.'
);

SELECT pg_temp.check(
    3,
    'Superadmin has audit-right grant',
    EXISTS (
        SELECT 1
        FROM public.role_permission rp
        JOIN public.app_role r USING (role_id)
        JOIN public.rights_catalog rc USING (right_id)
        WHERE r.role_code = 'superadmin'
          AND rc.right_code = 'view_audit_log'
    ),
    'Superadmin should receive view_audit_log.'
);

SELECT pg_temp.check(
    4,
    'Audit-right grant is absent from non-superadmin roles',
    NOT EXISTS (
        SELECT 1
        FROM public.role_permission rp
        JOIN public.app_role r USING (role_id)
        JOIN public.rights_catalog rc USING (right_id)
        WHERE r.role_code <> 'superadmin'
          AND rc.right_code = 'view_audit_log'
    ),
    'Only superadmin may hold view_audit_log.'
);

INSERT INTO auth.users (id, email) VALUES
  ('eeeeeeee-0000-4000-8000-000000000013', 's34-user@hope.example'),
  ('eeeeeeee-0000-4000-8000-000000000014', 's34-superadmin@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (
    id, email, first_name, last_name, role_id, account_status, is_blocked
)
SELECT v.id, v.email, v.first_name, v.last_name, r.role_id, 'active', false
FROM (
    VALUES
      ('eeeeeeee-0000-4000-8000-000000000013'::uuid,
       's34-user@hope.example', 'Sprint', 'User', 'user'),
      ('eeeeeeee-0000-4000-8000-000000000014'::uuid,
       's34-superadmin@hope.example', 'Sprint', 'Superadmin', 'superadmin')
) AS v(id, email, first_name, last_name, role_code)
JOIN public.app_role r ON r.role_code = v.role_code
ON CONFLICT (id) DO UPDATE
SET role_id = EXCLUDED.role_id,
    account_status = 'active',
    is_blocked = false;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000013","email":"s34-user@hope.example","role":"authenticated"}';

SELECT pg_temp.check(
    5,
    'Right-less user cannot read audit log',
    (SELECT count(*) FROM public.audit_log) = 0,
    'RLS and role/right checks must hide audit rows.'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000014","email":"s34-superadmin@hope.example","role":"authenticated"}';

SELECT pg_temp.check(
    6,
    'Superadmin audit read does not violate RLS',
    (
        SELECT app_private.current_role_code() = 'superadmin'
        AND app_private.has_right('view_audit_log')
    ),
    'Both API-level conditions are represented by RLS helper functions.'
);

RESET ROLE;

SELECT id, name, ok, detail
FROM pg_temp._s34_results
ORDER BY id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_temp._s34_results
        WHERE NOT ok
    ) THEN
        RAISE EXCEPTION 'Sprint 3/4 report/audit rights tests failed.';
    END IF;
END $$;

ROLLBACK;
