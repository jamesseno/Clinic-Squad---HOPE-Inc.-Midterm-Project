-- Sprint 4: Sales, Payments, Reports and Audit access control and views.

-- Ensure soft-delete columns exist on sales tables (base migration adds them, but be safe).
DO $$
BEGIN
  FOR r IN SELECT unnest(ARRAY['sales','salesdetail','payment']) AS t LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name='is_deleted') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE', r.t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name='stamp') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN stamp VARCHAR(100)', r.t);
    END IF;
  END LOOP;
END $$;

-- RLS enable.
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesdetail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

-- Grants.
GRANT SELECT, INSERT, UPDATE ON public.sales, public.salesdetail, public.payment TO authenticated;
REVOKE DELETE ON public.sales, public.salesdetail, public.payment FROM anon, authenticated;

-- Rights for sales module (add to rights_catalog if not present).
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

-- Also add report rights to reports module.
INSERT INTO public.rights_catalog (module_id, right_code, right_name, display_order, is_active)
SELECT m.module_id, v.code, v.name, v.ord, true
FROM public.module m
CROSS JOIN (VALUES
  ('view_report', 'View Report', 1)
) AS v(code, name, ord)
WHERE m.module_code = 'reports'
  AND NOT EXISTS (SELECT 1 FROM public.rights_catalog rc WHERE rc.right_code = v.code)
ON CONFLICT DO NOTHING;

-- Grant sales rights to roles.
INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role r
CROSS JOIN public.rights_catalog rc
JOIN public.module m ON m.module_id = rc.module_id
WHERE m.module_code IN ('sales', 'reports')
  AND r.role_code IN ('superadmin', 'admin')
  AND NOT EXISTS (SELECT 1 FROM public.role_permission rp WHERE rp.role_id=r.role_id AND rp.right_id=rc.right_id)
ON CONFLICT DO NOTHING;

-- Sales RLS policies.
DROP POLICY IF EXISTS sales_read ON public.sales;
CREATE POLICY sales_read ON public.sales FOR SELECT TO authenticated
  USING ((app_private.has_right('view_sale') OR app_private.has_right('add_sale') OR app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
         AND (NOT is_deleted OR app_private.has_right('delete_sale')));
DROP POLICY IF EXISTS sales_add ON public.sales FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_sale'));
DROP POLICY IF EXISTS sales_update ON public.sales FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
  WITH CHECK (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));

-- Salesdetail RLS.
DROP POLICY IF EXISTS salesdetail_read ON public.salesdetail FOR SELECT TO authenticated
  USING (app_private.has_right('view_sale') OR app_private.has_right('add_sale') OR app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));
DROP POLICY IF EXISTS salesdetail_add ON public.salesdetail FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_sale'));
DROP POLICY IF EXISTS salesdetail_update ON public.salesdetail FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'))
  WITH CHECK (app_private.has_right('edit_sale') OR app_private.has_right('delete_sale'));

-- Payment RLS.
DROP POLICY IF EXISTS payment_read ON public.payment FOR SELECT TO authenticated
  USING (app_private.has_right('view_payment') OR app_private.has_right('add_payment') OR app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'));
DROP POLICY IF EXISTS payment_add ON public.payment FOR INSERT TO authenticated
  WITH CHECK (app_private.has_right('add_payment'));
DROP POLICY IF EXISTS payment_update ON public.payment FOR UPDATE TO authenticated
  USING (app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'))
  WITH CHECK (app_private.has_right('edit_payment') OR app_private.has_right('delete_payment'));

-- Guard trigger for sales tables.
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

-- View: payment balance per transaction.
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

-- View: sales totals by product.
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

-- Indexes.
CREATE INDEX IF NOT EXISTS sales_custno_idx ON public.sales(custno);
CREATE INDEX IF NOT EXISTS sales_empno_idx ON public.sales(empno);
CREATE INDEX IF NOT EXISTS sales_salesdate_idx ON public.sales(salesdate);
CREATE INDEX IF NOT EXISTS salesdetail_transno_idx ON public.salesdetail(transno);
CREATE INDEX IF NOT EXISTS payment_transno_idx ON public.payment(transno);

-- Child-delete guard: sales with details or payments cannot be soft-deleted.
-- (Already handled by base migration's trg_check_children for 'sales'.)
