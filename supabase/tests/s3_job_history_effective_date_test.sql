BEGIN;

DROP TABLE IF EXISTS pg_temp._s3_effective_date_results;
CREATE TEMP TABLE pg_temp._s3_effective_date_results (
    id integer PRIMARY KEY,
    name text NOT NULL,
    ok boolean NOT NULL,
    detail text
);

CREATE OR REPLACE FUNCTION pg_temp.check_effective_date(
    p_id integer,
    p_name text,
    p_ok boolean,
    p_detail text
)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO pg_temp._s3_effective_date_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, ok = EXCLUDED.ok, detail = EXCLUDED.detail;
$$;

INSERT INTO public.employee (empno, lastname, firstname, gender, birthdate, hiredate)
VALUES ('Z9910', 'Test', 'Effective', 'F', '1990-01-01', CURRENT_DATE - 30);

INSERT INTO public.jobhistory (empno, jobcode, effdate, salary, deptcode)
VALUES
    ('Z9910', 'PR1', CURRENT_DATE, 40000, 'IT'),
    ('Z9910', 'PR2', CURRENT_DATE - 10, 45000, 'IT');

SELECT pg_temp.check_effective_date(
    1,
    'distinct effective dates allow historical entries to be inserted out of order',
    (
        SELECT count(*) = 2
        FROM public.jobhistory
        WHERE empno = 'Z9910'
          AND NOT is_deleted
    ),
    'Both dates should remain representable regardless of insertion order.'
);

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    BEGIN
        INSERT INTO public.jobhistory (empno, jobcode, effdate, salary, deptcode)
        VALUES ('Z9910', 'ANYS', CURRENT_DATE, 50000, 'IT');
        RAISE EXCEPTION 'Expected duplicate active effective date to be rejected.';
    EXCEPTION
        WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
            IF v_constraint_name <> 'jobhistory_active_employee_effective_date_unique' THEN
                RAISE;
            END IF;
    END;
END
$$;

SELECT pg_temp.check_effective_date(
    2,
    'an employee cannot have two active history rows on the same effective date',
    (
        SELECT count(*) = 0
        FROM public.jobhistory
        WHERE empno = 'Z9910'
          AND jobcode = 'ANYS'
          AND effdate = CURRENT_DATE
          AND NOT is_deleted
    ),
    'The duplicate row must not persist.'
);

SELECT id, name, ok, detail
FROM pg_temp._s3_effective_date_results
ORDER BY id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_temp._s3_effective_date_results
        WHERE NOT ok
    ) THEN
        RAISE EXCEPTION 'Sprint 3 job-history effective-date tests failed.';
    END IF;
END
$$;

ROLLBACK;
