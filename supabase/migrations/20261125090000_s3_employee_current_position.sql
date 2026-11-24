CREATE OR REPLACE VIEW public.employee_current_position
WITH (security_invoker = true)
AS
SELECT
    e.empno,
    current_history.jobcode,
    j.jobdesc,
    current_history.effdate,
    current_history.deptcode,
    d.deptname
FROM public.employee AS e
LEFT JOIN LATERAL (
    SELECT jh.jobcode, jh.effdate, jh.deptcode
    FROM public.jobhistory AS jh
    WHERE jh.empno = e.empno
      AND jh.effdate <= CURRENT_DATE
      AND NOT jh.is_deleted
    ORDER BY jh.effdate DESC, jh.jobcode ASC
    LIMIT 1
) AS current_history ON true
LEFT JOIN public.job AS j
    ON j.jobcode = current_history.jobcode
   AND NOT j.is_deleted
LEFT JOIN public.department AS d
    ON d.deptcode = current_history.deptcode
   AND NOT d.is_deleted
WHERE NOT e.is_deleted;

REVOKE ALL ON TABLE public.employee_current_position FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.employee_current_position TO service_role;
