-- Parameterized, read-only report query contract.
-- Each entry point checks its own report right. SECURITY DEFINER is used only
-- to make the query independent of underlying-table RLS; results are explicitly
-- scoped to active records and the caller's report right.

CREATE OR REPLACE FUNCTION app_private.report_sales_line_data(
    p_from date,
    p_to date,
    p_empno varchar
)
RETURNS TABLE (
    transno varchar,
    salesdate date,
    custno varchar,
    empno varchar,
    prodcode varchar,
    description varchar,
    quantity numeric,
    unitprice numeric,
    line_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.sales AS s
        JOIN public.salesdetail AS sd
          ON sd.transno = s.transno
         AND NOT sd.is_deleted
        WHERE NOT s.is_deleted
          AND (p_from IS NULL OR s.salesdate >= p_from)
          AND (p_to IS NULL OR s.salesdate <= p_to)
          AND (p_empno IS NULL OR s.empno = p_empno)
          AND NOT EXISTS (
              SELECT 1
              FROM public.pricehist AS ph
              WHERE ph.prodcode = sd.prodcode
                AND ph.effdate <= s.salesdate
                AND NOT ph.is_deleted
          )
    ) THEN
        RAISE EXCEPTION
            'An active sale line has no active price effective on its sale date; report totals are unavailable until reviewed.'
            USING ERRCODE = '23514';
    END IF;

    RETURN QUERY
    SELECT
        s.transno,
        s.salesdate,
        s.custno,
        s.empno,
        sd.prodcode,
        p.description,
        sd.quantity,
        price.unitprice,
        sd.quantity * price.unitprice
    FROM public.sales AS s
    JOIN public.salesdetail AS sd
      ON sd.transno = s.transno
     AND NOT sd.is_deleted
    JOIN public.product AS p
      ON p.prodcode = sd.prodcode
     AND NOT p.is_deleted
    JOIN LATERAL (
        SELECT ph.unitprice
        FROM public.pricehist AS ph
        WHERE ph.prodcode = sd.prodcode
          AND ph.effdate <= s.salesdate
          AND NOT ph.is_deleted
        ORDER BY ph.effdate DESC
        LIMIT 1
    ) AS price ON true
    WHERE NOT s.is_deleted
      AND (p_from IS NULL OR s.salesdate >= p_from)
      AND (p_to IS NULL OR s.salesdate <= p_to)
      AND (p_empno IS NULL OR s.empno = p_empno);
END
$$;

REVOKE ALL ON FUNCTION app_private.report_sales_line_data(date, date, varchar)
    FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.report_top_customers(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL,
    p_top_n integer DEFAULT 10,
    p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
    rank bigint,
    custno varchar,
    custname varchar,
    total_sales numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('top_customers') THEN
        RAISE EXCEPTION 'You do not have access to the Top Customers report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_top_n IS NULL OR p_top_n < 1 OR p_top_n > 100 THEN
        RAISE EXCEPTION 'Top N must be between 1 and 100.'
            USING ERRCODE = '22023';
    END IF;
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
        RAISE EXCEPTION 'The start date must be on or before the end date.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH totals AS (
        SELECT lines.custno, sum(lines.line_total) AS amount
        FROM app_private.report_sales_line_data(p_from, p_to, p_empno) AS lines
        WHERE lines.custno IS NOT NULL
        GROUP BY lines.custno
    ),
    ranked AS (
        SELECT
            row_number() OVER (ORDER BY totals.amount DESC, totals.custno) AS row_rank,
            totals.custno,
            c.custname,
            totals.amount
        FROM totals
        JOIN public.customer AS c
          ON c.custno = totals.custno
         AND NOT c.is_deleted
    )
    SELECT ranked.row_rank, ranked.custno, ranked.custname, ranked.amount
    FROM ranked
    ORDER BY ranked.row_rank
    LIMIT p_top_n;
END
$$;

CREATE OR REPLACE FUNCTION public.report_product_master_list(
    p_as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    prodcode varchar,
    description varchar,
    unit varchar,
    effdate date,
    unitprice numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('product_master_list') THEN
        RAISE EXCEPTION 'You do not have access to the Product Master List report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'An as-of date is required.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT p.prodcode, p.description, p.unit, price.effdate, price.unitprice
    FROM public.product AS p
    LEFT JOIN LATERAL (
        SELECT ph.effdate, ph.unitprice
        FROM public.pricehist AS ph
        WHERE ph.prodcode = p.prodcode
          AND ph.effdate <= p_as_of
          AND NOT ph.is_deleted
        ORDER BY ph.effdate DESC
        LIMIT 1
    ) AS price ON true
    WHERE NOT p.is_deleted
    ORDER BY p.prodcode;
END
$$;

CREATE OR REPLACE FUNCTION public.report_top_products(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL,
    p_top_n integer DEFAULT 10,
    p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
    rank bigint,
    prodcode varchar,
    description varchar,
    total_qty numeric,
    total_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('top_products') THEN
        RAISE EXCEPTION 'You do not have access to the Top Products report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_top_n IS NULL OR p_top_n < 1 OR p_top_n > 100 THEN
        RAISE EXCEPTION 'Top N must be between 1 and 100.'
            USING ERRCODE = '22023';
    END IF;
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
        RAISE EXCEPTION 'The start date must be on or before the end date.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH totals AS (
        SELECT lines.prodcode, max(lines.description) AS product_description,
               sum(lines.quantity) AS quantity, sum(lines.line_total) AS amount
        FROM app_private.report_sales_line_data(p_from, p_to, p_empno) AS lines
        GROUP BY lines.prodcode
    ),
    ranked AS (
        SELECT
            row_number() OVER (ORDER BY totals.amount DESC, totals.prodcode) AS row_rank,
            totals.prodcode, totals.product_description, totals.quantity, totals.amount
        FROM totals
    )
    SELECT ranked.row_rank, ranked.prodcode, ranked.product_description,
           ranked.quantity, ranked.amount
    FROM ranked
    ORDER BY ranked.row_rank
    LIMIT p_top_n;
END
$$;

CREATE OR REPLACE FUNCTION public.report_top_sales(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL,
    p_top_n integer DEFAULT 10,
    p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
    rank bigint,
    transno varchar,
    salesdate date,
    custno varchar,
    empno varchar,
    total_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('top_sales') THEN
        RAISE EXCEPTION 'You do not have access to the Top Sales report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_top_n IS NULL OR p_top_n < 1 OR p_top_n > 100 THEN
        RAISE EXCEPTION 'Top N must be between 1 and 100.'
            USING ERRCODE = '22023';
    END IF;
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
        RAISE EXCEPTION 'The start date must be on or before the end date.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH totals AS (
        SELECT lines.transno, max(lines.salesdate) AS sale_date,
               max(lines.custno) AS customer_code, max(lines.empno) AS employee_code,
               sum(lines.line_total) AS amount
        FROM app_private.report_sales_line_data(p_from, p_to, p_empno) AS lines
        GROUP BY lines.transno
    ),
    ranked AS (
        SELECT row_number() OVER (ORDER BY totals.amount DESC, totals.transno) AS row_rank,
               totals.*
        FROM totals
    )
    SELECT ranked.row_rank, ranked.transno, ranked.sale_date,
           ranked.customer_code, ranked.employee_code, ranked.amount
    FROM ranked
    ORDER BY ranked.row_rank
    LIMIT p_top_n;
END
$$;

CREATE OR REPLACE FUNCTION public.report_active_employees(
    p_as_of date DEFAULT CURRENT_DATE,
    p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
    empno varchar,
    lastname varchar,
    firstname varchar,
    hiredate date,
    sepdate date,
    jobcode varchar,
    jobdesc varchar,
    deptcode varchar,
    deptname varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('active_employees') THEN
        RAISE EXCEPTION 'You do not have access to the Active Employees report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'An as-of date is required.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT e.empno, e.lastname, e.firstname, e.hiredate, e.sepdate,
           CASE WHEN app_private.has_right('view_job_history') THEN position.jobcode END,
           CASE WHEN app_private.has_right('view_job_history') THEN j.jobdesc END,
           CASE WHEN app_private.has_right('view_job_history') THEN position.deptcode END,
           CASE WHEN app_private.has_right('view_job_history') THEN d.deptname END
    FROM public.employee AS e
    LEFT JOIN LATERAL (
        SELECT jh.jobcode, jh.deptcode
        FROM public.jobhistory AS jh
        WHERE jh.empno = e.empno
          AND NOT jh.is_deleted
          AND jh.effdate <= p_as_of
        ORDER BY jh.effdate DESC
        LIMIT 1
    ) AS position ON true
    LEFT JOIN public.job AS j
      ON j.jobcode = position.jobcode
     AND NOT j.is_deleted
    LEFT JOIN public.department AS d
      ON d.deptcode = position.deptcode
     AND NOT d.is_deleted
    WHERE NOT e.is_deleted
      AND e.hiredate <= p_as_of
      AND (e.sepdate IS NULL OR e.sepdate > p_as_of)
      AND (p_empno IS NULL OR e.empno = p_empno)
    ORDER BY e.lastname, e.firstname, e.empno;
END
$$;

CREATE OR REPLACE FUNCTION public.report_all_employees(
    p_as_of date DEFAULT CURRENT_DATE,
    p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
    empno varchar,
    lastname varchar,
    firstname varchar,
    hiredate date,
    sepdate date,
    is_deleted boolean,
    jobcode varchar,
    jobdesc varchar,
    deptcode varchar,
    deptname varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('all_employees') THEN
        RAISE EXCEPTION 'You do not have access to the All Employees report.'
            USING ERRCODE = '42501';
    END IF;
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'An as-of date is required.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT e.empno, e.lastname, e.firstname, e.hiredate, e.sepdate, e.is_deleted,
           CASE WHEN app_private.has_right('view_job_history') THEN position.jobcode END,
           CASE WHEN app_private.has_right('view_job_history') THEN j.jobdesc END,
           CASE WHEN app_private.has_right('view_job_history') THEN position.deptcode END,
           CASE WHEN app_private.has_right('view_job_history') THEN d.deptname END
    FROM public.employee AS e
    LEFT JOIN LATERAL (
        SELECT jh.jobcode, jh.deptcode
        FROM public.jobhistory AS jh
        WHERE jh.empno = e.empno
          AND NOT jh.is_deleted
          AND jh.effdate <= p_as_of
        ORDER BY jh.effdate DESC
        LIMIT 1
    ) AS position ON true
    LEFT JOIN public.job AS j
      ON j.jobcode = position.jobcode
     AND NOT j.is_deleted
    LEFT JOIN public.department AS d
      ON d.deptcode = position.deptcode
     AND NOT d.is_deleted
    WHERE e.hiredate <= p_as_of
      AND (NOT e.is_deleted OR app_private.has_right('delete_employee'))
      AND (p_empno IS NULL OR e.empno = p_empno)
    ORDER BY e.lastname, e.firstname, e.empno;
END
$$;

CREATE OR REPLACE FUNCTION public.report_employee_job_history(
    p_empno varchar DEFAULT NULL,
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL
)
RETURNS TABLE (
    empno varchar,
    lastname varchar,
    firstname varchar,
    jobcode varchar,
    jobdesc varchar,
    deptcode varchar,
    deptname varchar,
    effdate date,
    salary numeric,
    is_deleted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT app_private.has_right('employee_job_history') THEN
        RAISE EXCEPTION 'You do not have access to the Employee Job History report.'
            USING ERRCODE = '42501';
    END IF;
    IF NOT app_private.has_right('view_job_history') THEN
        RAISE EXCEPTION 'You do not have permission to view Job History.'
            USING ERRCODE = '42501';
    END IF;
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
        RAISE EXCEPTION 'The start date must be on or before the end date.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT e.empno, e.lastname, e.firstname, jh.jobcode, j.jobdesc,
           jh.deptcode, d.deptname, jh.effdate,
           jh.salary,
           jh.is_deleted
    FROM public.jobhistory AS jh
    JOIN public.employee AS e ON e.empno = jh.empno
    LEFT JOIN public.job AS j ON j.jobcode = jh.jobcode
    LEFT JOIN public.department AS d ON d.deptcode = jh.deptcode
    WHERE (NOT e.is_deleted OR app_private.has_right('delete_employee'))
      AND (NOT jh.is_deleted OR app_private.has_right('delete_job_history'))
      AND (p_empno IS NULL OR jh.empno = p_empno)
      AND (p_from IS NULL OR jh.effdate >= p_from)
      AND (p_to IS NULL OR jh.effdate <= p_to)
    ORDER BY jh.empno, jh.effdate DESC;
END
$$;

REVOKE ALL ON FUNCTION public.report_top_customers(date, date, integer, varchar)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_product_master_list(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_top_products(date, date, integer, varchar)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_top_sales(date, date, integer, varchar)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_active_employees(date, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_all_employees(date, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_employee_job_history(varchar, date, date)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.report_top_customers(date, date, integer, varchar)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_product_master_list(date)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_top_products(date, date, integer, varchar)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_top_sales(date, date, integer, varchar)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_active_employees(date, varchar)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_all_employees(date, varchar)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_employee_job_history(varchar, date, date)
    TO authenticated;
