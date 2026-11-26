-- Regression test for direct table reads of Job History.
-- Run after migrations and seed on an authorized non-production database.
-- All fixture records and role grants are rolled back.

BEGIN;

DROP TABLE IF EXISTS pg_temp._s3_jobhistory_read_results;
CREATE TEMP TABLE pg_temp._s3_jobhistory_read_results (
    id integer PRIMARY KEY,
    test_name text NOT NULL,
    ok boolean NOT NULL,
    detail text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.check_read(
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
    INSERT INTO _s3_jobhistory_read_results (id, test_name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
    SET test_name = EXCLUDED.test_name,
        ok = EXCLUDED.ok,
        detail = EXCLUDED.detail;
END
$$;

INSERT INTO auth.users (id, email) VALUES
    ('eeeeeeee-0000-4000-8000-000000000021', 's3-jh-add@hope.example'),
    ('eeeeeeee-0000-4000-8000-000000000022', 's3-jh-edit@hope.example'),
    ('eeeeeeee-0000-4000-8000-000000000023', 's3-jh-delete@hope.example'),
    ('eeeeeeee-0000-4000-8000-000000000024', 's3-jh-view@hope.example'),
    ('eeeeeeee-0000-4000-8000-000000000025', 's3-jh-none@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (
    id, email, first_name, last_name, role_id, account_status, is_blocked
)
SELECT v.id, v.email, 'Sprint', v.last_name, r.role_id, 'active', false
FROM (
    VALUES
      ('eeeeeeee-0000-4000-8000-000000000021'::uuid, 's3-jh-add@hope.example', 'Add'),
      ('eeeeeeee-0000-4000-8000-000000000022'::uuid, 's3-jh-edit@hope.example', 'Edit'),
      ('eeeeeeee-0000-4000-8000-000000000023'::uuid, 's3-jh-delete@hope.example', 'Delete'),
      ('eeeeeeee-0000-4000-8000-000000000024'::uuid, 's3-jh-view@hope.example', 'View'),
      ('eeeeeeee-0000-4000-8000-000000000025'::uuid, 's3-jh-none@hope.example', 'None')
) AS v(id, email, last_name)
JOIN public.app_role AS r ON r.role_code = 'user'
ON CONFLICT (id) DO UPDATE
SET role_id = EXCLUDED.role_id,
    account_status = 'active',
    is_blocked = false;

INSERT INTO public.user_permission (user_id, right_id)
SELECT v.user_id, rc.right_id
FROM (
    VALUES
      ('eeeeeeee-0000-4000-8000-000000000021'::uuid, 'add_job_history'),
      ('eeeeeeee-0000-4000-8000-000000000021'::uuid, 'active_employees'),
      ('eeeeeeee-0000-4000-8000-000000000021'::uuid, 'all_employees'),
      ('eeeeeeee-0000-4000-8000-000000000021'::uuid, 'employee_job_history'),
      ('eeeeeeee-0000-4000-8000-000000000022'::uuid, 'edit_job_history'),
      ('eeeeeeee-0000-4000-8000-000000000023'::uuid, 'delete_job_history'),
      ('eeeeeeee-0000-4000-8000-000000000024'::uuid, 'view_job_history')
) AS v(user_id, right_code)
JOIN public.rights_catalog AS rc
  ON rc.right_code = v.right_code
 AND rc.is_active
ON CONFLICT (user_id, right_id) DO UPDATE
SET is_deleted = false,
    deleted_at = NULL;

-- A user with no HR rights must not see Job History either.
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000025","email":"s3-jh-none@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_read(
    1, 'No-right account cannot read jobhistory',
    (SELECT count(*) FROM public.jobhistory) = 0,
    'Direct SELECT must be denied without any Job History right.'
);
RESET ROLE;

-- Add-only right must not satisfy the explicit view gate.
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000021","email":"s3-jh-add@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_read(
    2, 'Add-only cannot read jobhistory',
    (SELECT count(*) FROM public.jobhistory) = 0,
    'Direct SELECT must be denied without view_job_history.'
);
SELECT pg_temp.check_read(
    6, 'Employee reports hide current job data without view_job_history',
    (SELECT count(*) > 0
       AND count(*) FILTER (
         WHERE jobcode IS NOT NULL OR jobdesc IS NOT NULL
            OR deptcode IS NOT NULL OR deptname IS NOT NULL
       ) = 0
     FROM public.report_active_employees(CURRENT_DATE, NULL))
    AND
    (SELECT count(*) > 0
       AND count(*) FILTER (
         WHERE jobcode IS NOT NULL OR jobdesc IS NOT NULL
            OR deptcode IS NOT NULL OR deptname IS NOT NULL
       ) = 0
     FROM public.report_all_employees(CURRENT_DATE, NULL)),
    'Employee report results must not expose current Job History details without the explicit read right.'
);
DO $$
BEGIN
    BEGIN
        PERFORM 1 FROM public.report_employee_job_history(NULL, NULL, NULL);
        PERFORM pg_temp.check_read(
            7, 'Job History report requires view_job_history', false,
            'The report returned without the explicit read right.'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            PERFORM pg_temp.check_read(
                7, 'Job History report requires view_job_history', true,
                'The report function denied access without the explicit read right.'
            );
    END;
END
$$;
RESET ROLE;

-- Edit-only right must not satisfy the explicit view gate.
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000022","email":"s3-jh-edit@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_read(
    3, 'Edit-only cannot read jobhistory',
    (SELECT count(*) FROM public.jobhistory) = 0,
    'Direct SELECT must be denied without view_job_history.'
);
RESET ROLE;

-- Delete-only right must not satisfy the explicit view gate.
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000023","email":"s3-jh-delete@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_read(
    4, 'Delete-only cannot read jobhistory',
    (SELECT count(*) FROM public.jobhistory) = 0,
    'Delete permission does not imply read permission.'
);
RESET ROLE;

-- The explicit view right still allows active history reads.
SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000024","email":"s3-jh-view@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_read(
    5, 'View right can read active jobhistory',
    (SELECT count(*) FROM public.jobhistory WHERE NOT is_deleted) > 0,
    'A seeded active history row is required for this regression test.'
);
RESET ROLE;

SELECT id, test_name, ok, detail
FROM pg_temp._s3_jobhistory_read_results
ORDER BY id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_temp._s3_jobhistory_read_results
        WHERE NOT ok
    ) THEN
        RAISE EXCEPTION 'Job History read-privacy regression test failed.';
    END IF;
END
$$;

ROLLBACK;
