BEGIN;

DROP TABLE IF EXISTS pg_temp._s3_current_position_results;
CREATE TEMP TABLE pg_temp._s3_current_position_results (
    id integer PRIMARY KEY,
    name text NOT NULL,
    ok boolean NOT NULL,
    detail text
);

CREATE OR REPLACE FUNCTION pg_temp.check_current_position(
    p_id integer,
    p_name text,
    p_ok boolean,
    p_detail text
)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO pg_temp._s3_current_position_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, ok = EXCLUDED.ok, detail = EXCLUDED.detail;
$$;

INSERT INTO public.employee (empno, lastname, firstname, gender, birthdate, hiredate)
VALUES
    ('Z9901', 'Test', 'History', 'F', '1990-01-01', CURRENT_DATE - 30),
    ('Z9902', 'Test', 'NoHistory', 'M', '1990-01-01', CURRENT_DATE - 30);

INSERT INTO public.jobhistory (empno, jobcode, effdate, salary, deptcode)
VALUES
    ('Z9901', 'PR1', CURRENT_DATE - 10, 40000, 'IT'),
    ('Z9901', 'PR2', CURRENT_DATE + 10, 45000, 'IT');

SELECT pg_temp.check_current_position(
    1,
    'latest effective history row excludes future assignments',
    COALESCE((
        SELECT jobcode = 'PR1'
           AND jobdesc = 'Programmer 1'
           AND effdate = CURRENT_DATE - 10
           AND deptcode = 'IT'
           AND deptname = 'Information Tech'
        FROM public.employee_current_position
        WHERE empno = 'Z9901'
    ), false),
    'Expected the latest non-deleted history row effective on or before today.'
);

SELECT pg_temp.check_current_position(
    2,
    'employees without history remain visible with null position fields',
    COALESCE((
        SELECT jobcode IS NULL
           AND jobdesc IS NULL
           AND effdate IS NULL
           AND deptcode IS NULL
           AND deptname IS NULL
        FROM public.employee_current_position
        WHERE empno = 'Z9902'
    ), false),
    'The left join should preserve employees who have no eligible history.'
);

SELECT pg_temp.check_current_position(
    3,
    'view is not directly granted to browser roles',
    NOT has_table_privilege('authenticated', 'public.employee_current_position', 'SELECT')
        AND NOT has_table_privilege('anon', 'public.employee_current_position', 'SELECT'),
    'Only trusted server-side code should query this privileged view.'
);

SELECT id, name, ok, detail
FROM pg_temp._s3_current_position_results
ORDER BY id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_temp._s3_current_position_results
        WHERE NOT ok
    ) THEN
        RAISE EXCEPTION 'Sprint 3 employee current-position tests failed.';
    END IF;
END
$$;

ROLLBACK;
