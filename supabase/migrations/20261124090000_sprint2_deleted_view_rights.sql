-- Align the Customer/Product/Price read policies with the per-right model.
--
-- The Sprint 2 access migration gated deleted rows on the caller's role
-- (admin/superadmin). Every other check in the app and database uses an
-- effective right, so a non-admin user who was granted delete_customer,
-- delete_product, or delete_price could not read deleted rows even though the
-- API allowed the request, and an admin whose delete right was revoked could
-- still read them. These policies use the matching delete right instead.

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
            OR app_private.has_right('delete_customer')
        )
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
            OR app_private.has_right('delete_product')
        )
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
            OR app_private.has_right('delete_price')
        )
    );
