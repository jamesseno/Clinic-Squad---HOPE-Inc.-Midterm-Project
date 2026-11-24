-- Sprint 3: Human Resources access control, views, and indexes.
-- Follows the Sprint 2 pattern: per-right RLS on department, job, employee,
-- jobhistory; soft-delete gating by the matching delete right; supporting
-- views for the current job and department roster.

-- Ensure soft-delete columns exist (base migration already adds them, but be safe).
DO $$
BEGIN
  FOR r IN
    SELECT unnest(ARRAY['department','job','employee','jobhistory']) AS t
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=r.t AND column_name='is_deleted') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE', r.t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=r.t AND column_name='stamp') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN stamp VARCHAR(100)', r.t);
    END IF;
  END LOOP;
END $$;

-- Link app_user to employee (S3-DBA-03).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='app_user' AND column_name='empno') THEN
    ALTER TABLE public.app_user ADD COLUMN empno VARCHAR(5) REFERENCES public.employee(empno) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS enable.
ALTER TABLE public.department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobhistory ENABLE ROW LEVEL SECURITY;

-- Grants.
GRANT SELECT, INSERT, UPDATE ON public.department, public.job, public.employee, public.jobhistory TO authenticated;
REVOKE DELETE ON public.department, public.job, public.employee, public.jobhistory FROM anon, authenticated;

-- Department policies.
DROP POLICY IF EXISTS department_read ON public.department;
CREATE POLICY department_read ON public.department FOR SELECT TO authenticated
  USING (app_private.has_right('view_department') OR app_private.has_right('add_department')
         OR app_private.has_right('edit_department') OR app_private.has_right('delete_department'));
DROP POLICY IF EXISTS department_add ON public.department FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_department'));
DROP POLICY IF EXISTS department_update ON public.department FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_department') OR app_private.has_right('delete_department'))
  WITH CHECK (app_private.has_right('edit_department') OR app_private.has_right('delete_department'));

-- Job policies.
DROP POLICY IF EXISTS job_read ON public.job FOR SELECT TO authenticated
  USING (app_private.has_right('view_job') OR app_private.has_right('add_job')
         OR app_private.has_right('edit_job') OR app_private.has_right('delete_job'));
DROP POLICY IF EXISTS job_add ON public.job FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_job'));
DROP POLICY IF EXISTS job_update ON public.job FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_job') OR app_private.has_right('delete_job'))
  WITH CHECK (app_private.has_right('edit_job') OR app_private.has_right('delete_job'));

-- Employee policies (salary visible only with view_job_history).
DROP POLICY IF EXISTS employee_read ON public.employee FOR SELECT TO authenticated
  USING (app_private.has_right('view_employee') OR app_private.has_right('add_employee')
         OR app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'));
DROP POLICY IF EXISTS employee_add ON public.employee FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_employee'));
DROP POLICY IF EXISTS employee_update ON public.employee FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'))
  WITH CHECK (app_private.has_right('edit_employee') OR app_private.has_right('delete_employee'));

-- Job history policies (salary visible only with view_job_history right).
DROP POLICY IF EXISTS jobhistory_read ON public.jobhistory FOR SELECT TO authenticated
  USING (app_private.has_right('view_job_history') OR app_private.has_right('add_job_history')
         OR app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'));
DROP POLICY IF EXISTS jobhistory_add ON public.jobhistory FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_job_history'));
DROP POLICY IF EXISTS jobhistory_update ON public.jobhistory FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'))
  WITH CHECK (app_private.has_right('edit_job_history') OR app_private.has_right('delete_job_history'));

-- Guard trigger for HR tables.
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

-- Attach guards.
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

-- View: current job per employee.
CREATE OR REPLACE VIEW public.employee_current_job AS
SELECT DISTINCT ON (jh.empno)
  jh.empno, jh.jobcode, j.jobdesc, jh.deptcode, d.deptname, jh.salary, jh.effdate
FROM public.jobhistory jh
JOIN public.job j ON j.jobcode = jh.jobcode
LEFT JOIN public.department d ON d.deptcode = jh.deptcode
WHERE NOT jh.is_deleted
ORDER BY jh.empno, jh.effdate DESC;

-- View: department roster count.
CREATE OR REPLACE VIEW public.department_summary AS
SELECT d.deptcode, d.deptname,
  (SELECT count(*) FROM public.employee e
     JOIN public.jobhistory jh ON jh.empno=e.empno AND NOT jh.is_deleted
     WHERE jh.deptcode=d.deptcode
     AND jh.effdate = (SELECT max(jh2.effdate) FROM public.jobhistory jh2 WHERE jh2.empno=jh.empno AND NOT jh2.is_deleted)
  ) AS employee_count
FROM public.department d
WHERE NOT d.is_deleted;

-- Indexes.
CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_idx ON public.jobhistory(empno, effdate DESC);
CREATE INDEX IF NOT EXISTS jobhistory_deptcode_idx ON public.jobhistory(deptcode);
CREATE INDEX IF NOT EXISTS employee_name_idx ON public.employee(lastname, firstname);

-- Grant HR rights to roles.
-- Superadmin gets all; Admin gets all HR rights (consistent with customer/product).
INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role r
CROSS JOIN public.rights_catalog rc
JOIN public.module m ON m.module_id = rc.module_id
WHERE m.module_code = 'human_resources'
  AND r.role_code IN ('superadmin', 'admin')
  AND NOT EXISTS (SELECT 1 FROM public.role_permission rp WHERE rp.role_id=r.role_id AND rp.right_id=rc.right_id)
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION app_private.check_jobhistory_no_dup_effdate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobhistory
             WHERE empno=NEW.empno AND effdate=NEW.effdate AND (empno,jobcode,effdate) IS DISTINCT FROM (OLD.empno,OLD.jobcode,OLD.effdate)
             AND NOT is_deleted) THEN
    RAISE EXCEPTION 'Duplicate effective date for this employee.' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobhistory_no_dup_effdate ON public.jobhistory;
CREATE TRIGGER jobhistory_no_dup_effdate
  BEFORE INSERT OR UPDATE ON public.jobhistory
  FOR EACH ROW EXECUTE FUNCTION app_private.check_jobhistory_no_dup_effdate();

-- Rights for HR module (add to rights_catalog if not present).
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
