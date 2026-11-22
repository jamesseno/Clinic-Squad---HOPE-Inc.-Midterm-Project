-- Sprint 2 Customer, Product, and Price access regression tests.
-- Run against an authorized non-production database after migrations and seed.
-- The transaction is rolled back; the test does not alter persistent records.

BEGIN;

DROP TABLE IF EXISTS pg_temp._s2_results;
CREATE TEMP TABLE pg_temp._s2_results (
    id integer PRIMARY KEY,
    name text NOT NULL,
    ok boolean NOT NULL,
    detail text
);

CREATE OR REPLACE FUNCTION pg_temp.check(
    p_id integer,
    p_name text,
    p_ok boolean,
    p_detail text
)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO pg_temp._s2_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, ok = EXCLUDED.ok, detail = EXCLUDED.detail;
$$;

INSERT INTO auth.users (id, email) VALUES
    ('dddddddd-0000-4000-8000-000000000001', 's2-admin@hope.example'),
    ('dddddddd-0000-4000-8000-000000000002', 's2-user@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (id, email, first_name, last_name, role_id, account_status, is_blocked)
SELECT v.id, v.email, v.first_name, v.last_name, r.role_id, 'active', false
FROM (
    VALUES
        ('dddddddd-0000-4000-8000-000000000001'::uuid, 's2-admin@hope.example', 'Sprint', 'Admin', 'admin'),
        ('dddddddd-0000-4000-8000-000000000002'::uuid, 's2-user@hope.example', 'Sprint', 'User', 'user')
) AS v(id, email, first_name, last_name, role_code)
JOIN public.app_role AS r ON r.role_code = v.role_code
ON CONFLICT (id) DO UPDATE
SET role_id = EXCLUDED.role_id,
    account_status = EXCLUDED.account_status,
    is_blocked = EXCLUDED.is_blocked;

SELECT pg_temp.check(
    1,
    'Admin is seeded all nine Sprint 2 action rights',
    (
        SELECT count(*)
        FROM public.role_permission AS rp
        JOIN public.app_role AS r USING (role_id)
        JOIN public.rights_catalog AS rc USING (right_id)
        JOIN public.module AS m USING (module_id)
        WHERE r.role_code = 'admin'
          AND m.module_code IN ('customer', 'product')
    ) = 9,
    'Expected 3 Customer rights and 6 Product/Price rights.'
);

SET LOCAL request.jwt.claims =
    '{"sub":"dddddddd-0000-4000-8000-000000000001","email":"s2-admin@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;

INSERT INTO public.customer (custno, custname, address, payterm)
VALUES ('Z9901', 'Sprint Test Customer', 'Temporary test address', '30D');
INSERT INTO public.product (prodcode, description, unit)
VALUES ('ZZ9901', 'Sprint Test Product', 'ea');
INSERT INTO public.pricehist (prodcode, effdate, unitprice)
VALUES
    ('ZZ9901', '2026-01-01', 10.00),
    ('ZZ9901', '2026-02-01', 12.50);

SELECT set_config(
    's2_test.admin_create',
    (
        (SELECT count(*) FROM public.customer WHERE custno = 'Z9901') = 1
        AND (SELECT count(*) FROM public.product WHERE prodcode = 'ZZ9901') = 1
        AND (SELECT count(*) FROM public.pricehist WHERE prodcode = 'ZZ9901') = 2
    )::text,
    true
);
SELECT set_config(
    's2_test.as_of_price',
    (
        public.product_price_as_of('ZZ9901', '2026-01-15') = 10.00
        AND public.product_price_as_of('ZZ9901', '2026-03-01') = 12.50
    )::text,
    true
);

UPDATE public.customer
SET custname = 'Updated Sprint Customer'
WHERE custno = 'Z9901';

UPDATE public.pricehist
SET unitprice = 13.00
WHERE prodcode = 'ZZ9901' AND effdate = '2026-02-01';

UPDATE public.pricehist
SET is_deleted = true
WHERE prodcode = 'ZZ9901' AND effdate = '2026-01-01';
UPDATE public.pricehist
SET is_deleted = false
WHERE prodcode = 'ZZ9901' AND effdate = '2026-01-01';
UPDATE public.customer
SET is_deleted = true
WHERE custno = 'Z9901';
UPDATE public.customer
SET is_deleted = false
WHERE custno = 'Z9901';

SELECT set_config(
    's2_test.admin_edit',
    (
        (SELECT custname FROM public.customer WHERE custno = 'Z9901') = 'Updated Sprint Customer'
        AND (SELECT unitprice FROM public.pricehist
             WHERE prodcode = 'ZZ9901' AND effdate = '2026-02-01') = 13.00
    )::text,
    true
);
SELECT set_config(
    's2_test.soft_delete_restore',
    (
        (SELECT count(*) FROM public.customer_active WHERE custno = 'Z9901') = 1
        AND (SELECT count(*) FROM public.pricehist_active
             WHERE prodcode = 'ZZ9901' AND effdate = '2026-01-01') = 1
    )::text,
    true
);

DO $$
BEGIN
    BEGIN
        UPDATE public.product SET is_deleted = true WHERE prodcode = 'ZZ9901';
        RAISE EXCEPTION 'Expected an active-price child guard to reject product deletion.';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM NOT LIKE 'Cannot delete product row:%' THEN
                RAISE;
            END IF;
    END;
END
$$;

RESET ROLE;
SELECT pg_temp.check(2, 'Admin can create Customer, Product, and Price records',
    current_setting('s2_test.admin_create') = 'true',
    'All three record types should be visible under the authenticated Admin role.');
SELECT pg_temp.check(3, 'price-as-of returns the latest effective price on or before the requested date',
    current_setting('s2_test.as_of_price') = 'true',
    'Expected 10.00 for Jan 15 and 12.50 for Mar 1.');
SELECT pg_temp.check(4, 'Admin can edit Customer and Price records',
    current_setting('s2_test.admin_edit') = 'true',
    'Edited values should be visible to the authorized Admin.');
SELECT pg_temp.check(5, 'soft delete and restore keep records and return them to active views',
    current_setting('s2_test.soft_delete_restore') = 'true',
    'Restored rows should appear in active views.');
SELECT pg_temp.check(6, 'active price history prevents product soft deletion',
    (SELECT NOT is_deleted FROM public.product WHERE prodcode = 'ZZ9901'),
    'The existing child-record guard should reject deleting a product with active prices.');

SET LOCAL request.jwt.claims =
    '{"sub":"dddddddd-0000-4000-8000-000000000002","email":"s2-user@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;

SELECT set_config(
    's2_test.user_cannot_read',
    (
        (SELECT count(*) FROM public.customer WHERE custno = 'Z9901') = 0
        AND (SELECT count(*) FROM public.product WHERE prodcode = 'ZZ9901') = 0
    )::text,
    true
);

DO $$
BEGIN
    BEGIN
        INSERT INTO public.customer (custno, custname, address, payterm)
        VALUES ('Z9902', 'Unauthorized Customer', 'Should not persist', 'COD');
        RAISE EXCEPTION 'Expected RLS to reject unauthorized customer creation.';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;
END
$$;

RESET ROLE;

SELECT pg_temp.check(7, 'User without module rights cannot read Customer or Product records',
    current_setting('s2_test.user_cannot_read') = 'true',
    'RLS must hide business records from users without an assigned right.');
SELECT pg_temp.check(
    8,
    'User without module rights cannot create a Customer',
    NOT EXISTS (SELECT 1 FROM public.customer WHERE custno = 'Z9902'),
    'The unauthorized insert must not create a business row.'
);

SELECT id, name, ok, detail FROM pg_temp._s2_results ORDER BY id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_temp._s2_results WHERE NOT ok) THEN
        RAISE EXCEPTION 'Sprint 2 Customer/Product access tests failed.';
    END IF;
END
$$;

ROLLBACK;
