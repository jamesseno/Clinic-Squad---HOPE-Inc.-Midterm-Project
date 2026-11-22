CREATE OR REPLACE FUNCTION app_private.has_right(p_right_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.app_user AS u
        JOIN public.app_role AS r USING (role_id)
        JOIN public.rights_catalog AS rc
          ON rc.right_code = p_right_code
         AND rc.is_active
        WHERE u.id = auth.uid()
          AND u.account_status = 'active'
          AND NOT u.is_blocked
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.role_permission AS rp
                  WHERE rp.role_id = r.role_id
                    AND rp.right_id = rc.right_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.user_permission AS up
                  WHERE up.user_id = u.id
                    AND up.right_id = rc.right_id
                    AND NOT up.is_deleted
              )
          )
    )
$$;

REVOKE ALL ON FUNCTION app_private.has_right(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_right(text) TO authenticated;

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricehist ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.customer, public.product, public.pricehist TO authenticated;
REVOKE DELETE ON public.customer, public.product, public.pricehist FROM anon, authenticated;

DROP POLICY IF EXISTS customer_read_by_right ON public.customer;
CREATE POLICY customer_read_by_right
    ON public.customer
    FOR SELECT
    TO authenticated
    USING (
        (
            app_private.has_right('add_customer')
            OR app_private.has_right('edit_customer')
            OR app_private.has_right('delete_customer')
        )
        AND (
            NOT is_deleted
            OR app_private.current_role_code() IN ('admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS customer_add_by_right ON public.customer;
CREATE POLICY customer_add_by_right
    ON public.customer
    FOR INSERT
    TO authenticated
    WITH CHECK (app_private.has_right('add_customer'));

DROP POLICY IF EXISTS customer_update_by_right ON public.customer;
CREATE POLICY customer_update_by_right
    ON public.customer
    FOR UPDATE
    TO authenticated
    USING (
        app_private.has_right('edit_customer')
        OR app_private.has_right('delete_customer')
    )
    WITH CHECK (
        app_private.has_right('edit_customer')
        OR app_private.has_right('delete_customer')
    );

DROP POLICY IF EXISTS product_read_by_right ON public.product;
CREATE POLICY product_read_by_right
    ON public.product
    FOR SELECT
    TO authenticated
    USING (
        (
            app_private.has_right('add_product')
            OR app_private.has_right('edit_product')
            OR app_private.has_right('delete_product')
            OR app_private.has_right('add_price')
            OR app_private.has_right('edit_price')
            OR app_private.has_right('delete_price')
        )
        AND (
            NOT is_deleted
            OR app_private.current_role_code() IN ('admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS product_add_by_right ON public.product;
CREATE POLICY product_add_by_right
    ON public.product
    FOR INSERT
    TO authenticated
    WITH CHECK (app_private.has_right('add_product'));

DROP POLICY IF EXISTS product_update_by_right ON public.product;
CREATE POLICY product_update_by_right
    ON public.product
    FOR UPDATE
    TO authenticated
    USING (
        app_private.has_right('edit_product')
        OR app_private.has_right('delete_product')
    )
    WITH CHECK (
        app_private.has_right('edit_product')
        OR app_private.has_right('delete_product')
    );

DROP POLICY IF EXISTS pricehist_read_by_right ON public.pricehist;
CREATE POLICY pricehist_read_by_right
    ON public.pricehist
    FOR SELECT
    TO authenticated
    USING (
        (
            app_private.has_right('add_price')
            OR app_private.has_right('edit_price')
            OR app_private.has_right('delete_price')
        )
        AND (
            NOT is_deleted
            OR app_private.current_role_code() IN ('admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS pricehist_add_by_right ON public.pricehist;
CREATE POLICY pricehist_add_by_right
    ON public.pricehist
    FOR INSERT
    TO authenticated
    WITH CHECK (app_private.has_right('add_price'));

DROP POLICY IF EXISTS pricehist_update_by_right ON public.pricehist;
CREATE POLICY pricehist_update_by_right
    ON public.pricehist
    FOR UPDATE
    TO authenticated
    USING (
        app_private.has_right('edit_price')
        OR app_private.has_right('delete_price')
    )
    WITH CHECK (
        app_private.has_right('edit_price')
        OR app_private.has_right('delete_price')
    );

CREATE OR REPLACE FUNCTION app_private.guard_customer_product_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_add_right text;
    v_edit_right text;
    v_delete_right text;
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'customer' THEN
            v_add_right := 'add_customer';
            v_edit_right := 'edit_customer';
            v_delete_right := 'delete_customer';
        WHEN 'product' THEN
            v_add_right := 'add_product';
            v_edit_right := 'edit_product';
            v_delete_right := 'delete_product';
        WHEN 'pricehist' THEN
            v_add_right := 'add_price';
            v_edit_right := 'edit_price';
            v_delete_right := 'delete_price';
        ELSE
            RAISE EXCEPTION 'Unsupported business table.'
                USING ERRCODE = '42501';
    END CASE;

    IF TG_OP = 'INSERT' THEN
        IF NOT app_private.has_right(v_add_right)
           OR (NEW.is_deleted AND NOT app_private.has_right(v_delete_right)) THEN
            RAISE EXCEPTION 'You do not have permission to add this record.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
       AND NOT app_private.has_right(v_delete_right) THEN
        RAISE EXCEPTION 'You do not have permission to delete or restore this record.'
            USING ERRCODE = '42501';
    END IF;

    IF (to_jsonb(NEW) - 'is_deleted' - 'stamp')
       IS DISTINCT FROM (to_jsonb(OLD) - 'is_deleted' - 'stamp')
       AND NOT app_private.has_right(v_edit_right) THEN
        RAISE EXCEPTION 'You do not have permission to edit this record.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION app_private.guard_customer_product_action() FROM PUBLIC;

CREATE TRIGGER customer_business_right_guard
    BEFORE INSERT OR UPDATE ON public.customer
    FOR EACH ROW EXECUTE FUNCTION app_private.guard_customer_product_action();
CREATE TRIGGER product_business_right_guard
    BEFORE INSERT OR UPDATE ON public.product
    FOR EACH ROW EXECUTE FUNCTION app_private.guard_customer_product_action();
CREATE TRIGGER pricehist_business_right_guard
    BEFORE INSERT OR UPDATE ON public.pricehist
    FOR EACH ROW EXECUTE FUNCTION app_private.guard_customer_product_action();

CREATE OR REPLACE FUNCTION public.product_price_as_of(
    p_prodcode varchar,
    p_as_of date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT ph.unitprice
    FROM public.pricehist AS ph
    JOIN public.product AS p ON p.prodcode = ph.prodcode
    WHERE ph.prodcode = p_prodcode
      AND ph.effdate <= p_as_of
      AND NOT ph.is_deleted
      AND NOT p.is_deleted
    ORDER BY ph.effdate DESC
    LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.product_price_as_of(varchar, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_price_as_of(varchar, date) TO authenticated;

CREATE INDEX IF NOT EXISTS customer_active_payterm_idx
    ON public.customer (payterm)
    WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS product_active_unit_idx
    ON public.product (unit)
    WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS pricehist_active_product_date_idx
    ON public.pricehist (prodcode, effdate DESC)
    WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS sales_active_customer_idx
    ON public.sales (custno)
    WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS salesdetail_active_product_idx
    ON public.salesdetail (prodcode)
    WHERE NOT is_deleted;

CREATE OR REPLACE VIEW public.customer_active
    WITH (security_invoker = true)
AS
SELECT *
FROM public.customer
WHERE NOT is_deleted;

CREATE OR REPLACE VIEW public.product_active
    WITH (security_invoker = true)
AS
SELECT *
FROM public.product
WHERE NOT is_deleted;

CREATE OR REPLACE VIEW public.pricehist_active
    WITH (security_invoker = true)
AS
SELECT *
FROM public.pricehist
WHERE NOT is_deleted;
