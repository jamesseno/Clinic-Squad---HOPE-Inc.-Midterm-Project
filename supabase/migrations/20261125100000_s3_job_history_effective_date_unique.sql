DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.jobhistory
        WHERE NOT is_deleted
        GROUP BY empno, effdate
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce one active job-history row per employee and effective date; resolve existing duplicates first.';
    END IF;
END
$$;

CREATE UNIQUE INDEX jobhistory_active_employee_effective_date_unique
    ON public.jobhistory (empno, effdate)
    WHERE NOT is_deleted;
