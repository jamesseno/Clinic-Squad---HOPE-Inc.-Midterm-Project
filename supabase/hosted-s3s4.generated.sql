-- HOPE Inc. ERP - Sprint 3 (HR) + Sprint 4 (Sales) migrations only.
-- Run this in the Supabase SQL Editor against the hosted project.
-- The base tables and S1 access-control tables already exist.
--
-- Generated 2026-11-24T19:17:19.970Z

-- =====================================================================
-- 20261125090000_sprint3_hr_access.sql
-- =====================================================================
-- Sprint 3: Human Resources access control, views, and indexes.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['department','job','employee','jobhistory'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='is_deleted') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='stamp') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN stamp VARCHAR(100)', t);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_user' AND column_name='empno') THEN
    ALTER TABLE public.app_user ADD COLUMN empno VARCHAR(5) REFERENCES public.employee(empno) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobhistory ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.department, public.job, public.employee, public.jobhistory TO authenticated;
REVOKE DELETE ON public.department, public.job, public.employee, public.jobhistory FROM anon, authenticated;

DROP POLICY IF EXISTS department_read ON public.department;
CREATE POLICY department_read ON public.department FOR SELECT TO authenticated
  USING (app_private.has_right('view_department') OR app_private.has_right('add_department')
         OR app_private.has_right('edit_department') OR app_private.has_right('delete_department'));

DROP POLICY IF EXISTS department_add ON public.department;
CREATE POLICY department_add ON public.department FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_department'));

DROP POLICY IF EXISTS department_update ON public.department;
CREATE POLICY department_update ON public.department FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_department') OR app_private.has_right('delete_department'))
  WITH CHECK (app_private.has_right('edit_department') OR app_private.has_right('delete_department'));

DROP POLICY IF EXISTS job_read ON public.job;
CREATE POLICY job_read ON public.job FOR SELECT TO authenticated
  USING (app_private.has_right('view_job') OR app_private.has_right('add_job')
         OR app_private.has_right('edit_job') OR app_private.has_right('delete_job'));

DROP POLICY IF EXISTS job_add ON public.job;
CREATE POLICY job_add ON public.job FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_job'));

DROP POLICY IF EXISTS job_update ON public.job;
CREATE POLICY job_update ON public.job FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_job') OR app_private.has_right('delete_job'))
  WITH CHECK (app_private.has_right('edit_job') OR app_private.has_right('delete_job'));

DROP POLICY IF EXISTS employee_read ON public.employee;
CREATE POLICY employee_read ON public.employee FOR SELECT TO authenticated
  USING (app_private.has_right('view_employee') OR app_private.has_right('add_employee')
         OR app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'));

DROP POLICY IF EXISTS employee_add ON public.employee;
CREATE POLICY employee_add ON public.employee FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_employee'));

DROP POLICY IF EXISTS employee_update ON public.employee;
CREATE POLICY employee_update ON public.employee FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'))
  WITH CHECK (app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'));

DROP POLICY IF EXISTS jobhistory_read ON public.jobhistory;
CREATE POLICY jobhistory_read ON public.jobhistory FOR SELECT TO authenticated
  USING (app_private.has_right('view_job_history') OR app_private.has_right('add_job_history')
         OR app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'));

DROP POLICY IF EXISTS jobhistory_add ON public.jobhistory;
CREATE POLICY jobhistory_add ON public.jobhistory FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_job_history'));

DROP POLICY IF EXISTS jobhistory_update ON public.jobhistory;
CREATE POLICY jobhistory_update ON public.jobhistory FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'))
  WITH CHECK (app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'));

CREATE OR REPLACE FUNCTION app_private.guard_hr_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_add text; v_edit text; v_delete text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'department' THEN v_add:='add_department'; v_edit:='edit_department'; v_delete:='delete_department';
    WHEN 'job' THEN v_add:='add_job'; v_edit:='edit_job'; v_delete:='delete_job';
    WHEN 'employee' THEN v_add:='add_employee'; v_edit:='edit_employee'; v_delete:='delete_employee';
    WHEN 'jobhistory' THEN v_add:='add_job_history'; v_edit:='edit_job_history'; v_delete:='delete_job_history';
  END CASE;
  IF TG_OP='INSERT' THEN
    IF NOT app_private.has_right(v_add) THEN
      RAISE EXCEPTION 'You do not have permission to add this record.' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted AND NOT app_private.has_right(v_delete) THEN
    RAISE EXCEPTION 'You do not have permission to delete or restore this record.' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW)-'is_deleted'-'stamp') IS DISTINCT FROM (to_jsonb(OLD)-'is_deleted'-'stamp')
     AND NOT app_private.has_right(v_edit) THEN
    RAISE EXCEPTION 'You do not have permission to edit this record.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_private.guard_hr_action() FROM PUBLIC;

DROP TRIGGER IF EXISTS department_hr_guard ON public.department;
CREATE TRIGGER department_hr_guard BEFORE INSERT OR UPDATE ON public.department
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_hr_action();
DROP TRIGGER IF EXISTS job_hr_guard ON public.job;
CREATE TRIGGER job_hr_guard BEFORE INSERT OR UPDATE ON public.job
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_hr_action();
DROP TRIGGER IF EXISTS employee_hr_guard ON public.employee;
CREATE TRIGGER employee_hr_guard BEFORE INSERT OR UPDATE ON public.employee
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_hr_action();
DROP TRIGGER IF EXISTS jobhistory_hr_guard ON public.jobhistory;
CREATE TRIGGER jobhistory_hr_guard BEFORE INSERT OR UPDATE ON public.jobhistory
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_hr_action();

CREATE OR REPLACE VIEW public.employee_current_job AS
SELECT DISTINCT ON (jh.empno)
  jh.empno, jh.jobcode, j.jobdesc, jh.deptcode, d.deptname, jh.salary, jh.effdate
FROM public.jobhistory jh
JOIN public.job j ON j.jobcode = jh.jobcode
LEFT JOIN public.department d ON d.deptcode = jh.deptcode
WHERE NOT jh.is_deleted
ORDER BY jh.empno, jh.effdate DESC;

CREATE OR REPLACE VIEW public.department_summary AS
SELECT d.deptcode, d.deptname,
  (SELECT count(*) FROM public.employee e
     JOIN public.jobhistory jh ON jh.empno=e.empno AND NOT jh.is_deleted
     WHERE jh.deptcode=d.deptcode
     AND jh.effdate = (SELECT max(jh2.effdate) FROM public.jobhistory jh2 WHERE jh2.empno=jh.empno AND NOT jh2.is_deleted)
  ) AS employee_count
FROM public.department d
WHERE NOT d.is_deleted;

CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_idx ON public.jobhistory(empno, effdate DESC);
CREATE INDEX IF NOT EXISTS jobhistory_deptcode_idx ON public.jobhistory(deptcode);
CREATE INDEX IF NOT EXISTS employee_name_idx ON public.employee(lastname, firstname);

CREATE OR REPLACE FUNCTION app_private.check_jobhistory_no_dup_effdate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobhistory
             WHERE empno=NEW.empno AND effdate=NEW.effdate AND NOT is_deleted
             AND (empno, jobcode, effdate) IS DISTINCT FROM (OLD.empno, OLD.jobcode, OLD.effdate)) THEN
    RAISE EXCEPTION 'Duplicate effective date for this employee.' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobhistory_no_dup_effdate ON public.jobhistory;
CREATE TRIGGER jobhistory_no_dup_effdate
  BEFORE INSERT OR UPDATE ON public.jobhistory
  FOR EACH ROW EXECUTE FUNCTION app_private.check_jobhistory_no_dup_effdate();

INSERT INTO public.rights_catalog (module_id, right_code, right_name, display_order, is_active)
SELECT m.module_id, v.code, v.name, v.ord, true
FROM public.module m
CROSS JOIN (VALUES
  ('view_department', 'View Department', 1),
  ('add_department', 'Add Department', 2),
  ('edit_department', 'Edit Department', 3),
  ('delete_department', 'Delete Department', 4),
  ('view_job', 'View Job', 5),
  ('add_job', 'Add Job', 6),
  ('edit_job', 'Edit Job', 7),
  ('delete_job', 'Delete Job', 8),
  ('view_employee', 'View Employee', 9),
  ('add_employee', 'Add Employee', 10),
  ('edit_employee', 'Edit Employee', 11),
  ('delete_employee', 'Delete Employee', 12),
  ('view_job_history', 'View Job History', 13),
  ('add_job_history', 'Add Job History', 14),
  ('edit_job_history', 'Edit Job History', 15),
  ('delete_job_history', 'Delete Job History', 16)
) AS v(code, name, ord)
WHERE m.module_code = 'human_resources'
  AND NOT EXISTS (SELECT 1 FROM public.rights_catalog rc WHERE rc.right_code = v.code)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role r
CROSS JOIN public.rights_catalog rc
JOIN public.module m ON m.module_id = rc.module_id
WHERE m.module_code = 'human_resources'
  AND r.role_code IN ('superadmin', 'admin')
  AND NOT EXISTS (SELECT 1 FROM public.role_permission rp WHERE rp.role_id=r.role_id AND rp.right_id=rc.right_id)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 20261126090000_sprint4_sales_access.sql
-- =====================================================================
-- Sprint 4: Sales, Payments, Reports and Audit access control and views.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','salesdetail','payment'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='is_deleted') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='stamp') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN stamp VARCHAR(100)', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesdetail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.sales, public.salesdetail, public.payment TO authenticated;
REVOKE DELETE ON public.sales, public.salesdetail, public.payment FROM anon, authenticated;

INSERT INTO public.rights_catalog (module_id, right_code, right_name, display_order, is_active)
SELECT m.module_id, v.code, v.name, v.ord, true
FROM public.module m
CROSS JOIN (VALUES
  ('view_sale', 'View Sale', 1),
  ('add_sale', 'Add Sale', 2),
  ('edit_sale', 'Edit Sale', 3),
  ('delete_sale', 'Delete Sale', 4),
  ('view_payment', 'View Payment', 5),
  ('add_payment', 'Add Payment', 6),
  ('edit_payment', 'Edit Payment', 7),
  ('delete_payment', 'Delete Payment', 8),
  ('view_report', 'View Report', 9),
  ('view_audit_log', 'View Audit Log', 10)
) AS v(code, name, ord)
WHERE m.module_code = 'sales'
  AND NOT EXISTS (SELECT 1 FROM public.rights_catalog rc WHERE rc.right_code = v.code)
ON CONFLICT DO NOTHING;

INSERT INTO public.rights_catalog (module_id, right_code, right_name, display_order, is_active)
SELECT m.module_id, v.code, v.name, v.ord, true
FROM public.module m
CROSS JOIN (VALUES
  ('view_report', 'View Report', 1)
) AS v(code, name, ord)
WHERE m.module_code = 'reports'
  AND NOT EXISTS (SELECT 1 FROM public.rights_catalog rc WHERE rc.right_code = v.code)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role r
CROSS JOIN public.rights_catalog rc
JOIN public.module m ON m.module_id = rc.module_id
WHERE m.module_code IN ('sales', 'reports')
  AND r.role_code IN ('superadmin', 'admin')
  AND NOT EXISTS (SELECT 1 FROM public.role_permission rp WHERE rp.role_id=r.role_id AND rp.right_id=rc.right_id)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS sales_read ON public.sales;
CREATE POLICY sales_read ON public.sales FOR SELECT TO authenticated
  USING ((app_private.has_right('view_sale') OR app_private.has_right('add_sale') OR app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
         AND (NOT is_deleted OR app_private.has_right('delete_sale')));

DROP POLICY IF EXISTS sales_add ON public.sales;
CREATE POLICY sales_add ON public.sales FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_sale'));

DROP POLICY IF EXISTS sales_update ON public.sales;
CREATE POLICY sales_update ON public.sales FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
  WITH CHECK (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));

DROP POLICY IF EXISTS salesdetail_read ON public.salesdetail;
CREATE POLICY salesdetail_read ON public.salesdetail FOR SELECT TO authenticated
  USING (app_private.has_right('view_sale') OR app_private.has_right('add_sale') OR app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));

DROP POLICY IF EXISTS salesdetail_add ON public.salesdetail;
CREATE POLICY salesdetail_add ON public.salesdetail FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_sale'));

DROP POLICY IF EXISTS salesdetail_update ON public.salesdetail;
CREATE POLICY salesdetail_update ON public.salesdetail FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
  WITH CHECK (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));

DROP POLICY IF EXISTS payment_read ON public.payment;
CREATE POLICY payment_read ON public.payment FOR SELECT TO authenticated
  USING (app_private.has_right('view_payment') OR app_private.has_right('add_payment') OR app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'));

DROP POLICY IF EXISTS payment_add ON public.payment;
CREATE POLICY payment_add ON public.payment FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_payment'));

DROP POLICY IF EXISTS payment_update ON public.payment;
CREATE POLICY payment_update ON public.payment FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'))
  WITH CHECK (app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'));

CREATE OR REPLACE FUNCTION app_private.guard_sales_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_add text; v_edit text; v_delete text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'sales' THEN v_add:='add_sale'; v_edit:='edit_sale'; v_delete:='delete_sale';
    WHEN 'salesdetail' THEN v_add:='add_sale'; v_edit:='edit_sale'; v_delete:='delete_sale';
    WHEN 'payment' THEN v_add:='add_payment'; v_edit:='edit_payment'; v_delete:='delete_payment';
  END CASE;
  IF TG_OP='INSERT' THEN
    IF NOT app_private.has_right(v_add) THEN RAISE EXCEPTION 'No permission to add.' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted AND NOT app_private.has_right(v_delete) THEN
    RAISE EXCEPTION 'No permission to delete or restore.' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW)-'is_deleted'-'stamp') IS DISTINCT FROM (to_jsonb(OLD)-'is_deleted'-'stamp')
     AND NOT app_private.has_right(v_edit) THEN
    RAISE EXCEPTION 'No permission to edit.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_private.guard_sales_action() FROM PUBLIC;

DROP TRIGGER IF EXISTS sales_guard ON public.sales;
CREATE TRIGGER sales_guard BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION app_private.guard_sales_action();
DROP TRIGGER IF EXISTS salesdetail_guard ON public.salesdetail;
CREATE TRIGGER salesdetail_guard BEFORE INSERT OR UPDATE ON public.salesdetail FOR EACH ROW EXECUTE FUNCTION app_private.guard_sales_action();
DROP TRIGGER IF EXISTS payment_guard ON public.payment;
CREATE TRIGGER payment_guard BEFORE INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION app_private.guard_sales_action();

CREATE OR REPLACE VIEW public.sales_balance AS
SELECT s.transno, s.salesdate, s.custno, s.empno,
  COALESCE((SELECT sum(sd.quantity * ph.unitprice)
            FROM public.salesdetail sd
            JOIN public.pricehist ph ON ph.prodcode = sd.prodcode
            WHERE sd.transno = s.transno AND NOT sd.is_deleted
            AND ph.effdate = (SELECT max(ph2.effdate) FROM public.pricehist ph2 WHERE ph2.prodcode = sd.prodcode AND ph2.effdate <= s.salesdate AND NOT ph2.is_deleted)
  ), 0) AS total_amount,
  COALESCE((SELECT sum(p.amount) FROM public.payment p WHERE p.transno = s.transno AND NOT p.is_deleted), 0) AS paid_amount,
  COALESCE((SELECT sum(sd.quantity * ph.unitprice)
            FROM public.salesdetail sd
            JOIN public.pricehist ph ON ph.prodcode = sd.prodcode
            WHERE sd.transno = s.transno AND NOT sd.is_deleted
            AND ph.effdate = (SELECT max(ph2.effdate) FROM public.pricehist ph2 WHERE ph2.prodcode = sd.prodcode AND ph2.effdate <= s.salesdate AND NOT ph2.is_deleted)
  ), 0) - COALESCE((SELECT sum(p.amount) FROM public.payment p WHERE p.transno = s.transno AND NOT p.is_deleted), 0) AS balance
FROM public.sales s
WHERE NOT s.is_deleted;

CREATE OR REPLACE VIEW public.sales_by_product AS
SELECT sd.prodcode, p.description,
  sum(sd.quantity) AS total_qty,
  sum(sd.quantity * ph.unitprice) AS total_amount
FROM public.salesdetail sd
JOIN public.product p ON p.prodcode = sd.prodcode
JOIN public.sales s ON s.transno = sd.transno AND NOT s.is_deleted
JOIN public.pricehist ph ON ph.prodcode = sd.prodcode
  AND ph.effdate = (SELECT max(ph2.effdate) FROM public.pricehist ph2 WHERE ph2.prodcode = sd.prodcode AND ph2.effdate <= s.salesdate AND NOT ph2.is_deleted)
WHERE NOT sd.is_deleted AND NOT p.is_deleted
GROUP BY sd.prodcode, p.description;

CREATE INDEX IF NOT EXISTS sales_custno_idx ON public.sales(custno);
CREATE INDEX IF NOT EXISTS sales_empno_idx ON public.sales(empno);
CREATE INDEX IF NOT EXISTS sales_salesdate_idx ON public.sales(salesdate);
CREATE INDEX IF NOT EXISTS salesdetail_transno_idx ON public.salesdetail(transno);
CREATE INDEX IF NOT EXISTS payment_transno_idx ON public.payment(transno);

