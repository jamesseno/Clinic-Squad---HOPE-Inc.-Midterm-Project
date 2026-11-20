-- Read-only verification for S1-DBA-05.
-- Run after the migrations and supabase/seed.sql have been applied to an authorized database.
-- It raises an exception on any mismatch and reports profile counts for roster review.

DO $$
DECLARE
    actual_roles text[];
    actual_modules text[];
    actual_right_count bigint;
BEGIN
    SELECT array_agg(role_code ORDER BY role_code)
    INTO actual_roles
    FROM public.app_role;

    IF actual_roles IS DISTINCT FROM ARRAY['admin', 'superadmin', 'user']::text[] THEN
        RAISE EXCEPTION 'Default roles mismatch: found %', actual_roles;
    END IF;

    SELECT array_agg(module_code ORDER BY display_order)
    INTO actual_modules
    FROM public.module;

    IF actual_modules IS DISTINCT FROM ARRAY[
        'customer', 'product', 'human_resources', 'sales', 'reports'
    ]::text[] THEN
        RAISE EXCEPTION 'Module catalogue mismatch: found %', actual_modules;
    END IF;

    -- Exact section 3.8 catalogue: 3 + 6 + 13 + 7 + 7 = 36 rights.
    IF EXISTS (
        WITH expected(module_code, right_code) AS (
            SELECT catalogue.module_code, action.right_code
            FROM (
                VALUES
                    ('customer', ARRAY['add_customer', 'edit_customer', 'delete_customer']),
                    ('product', ARRAY['add_product', 'edit_product', 'delete_product', 'add_price', 'edit_price', 'delete_price']),
                    ('human_resources', ARRAY['add_job', 'edit_job', 'delete_job', 'add_department', 'edit_department', 'delete_department', 'add_employee', 'edit_employee', 'delete_employee', 'view_job_history', 'add_job_history', 'edit_job_history', 'delete_job_history']),
                    ('sales', ARRAY['add_sale', 'edit_sale', 'delete_sale', 'view_sale_detail', 'add_sale_detail', 'edit_sale_detail', 'delete_sale_detail']),
                    ('reports', ARRAY['top_customers', 'product_master_list', 'top_products', 'active_employees', 'all_employees', 'employee_job_history', 'top_sales'])
            ) AS catalogue(module_code, right_codes)
            CROSS JOIN LATERAL unnest(catalogue.right_codes) AS action(right_code)
        ),
        actual AS (
            SELECT m.module_code, rc.right_code
            FROM public.rights_catalog AS rc
            JOIN public.module AS m USING (module_id)
        )
        SELECT module_code, right_code FROM (
            SELECT module_code, right_code FROM expected
            EXCEPT
            SELECT module_code, right_code FROM actual
        ) AS missing
        UNION ALL
        SELECT module_code, right_code FROM (
            SELECT module_code, right_code FROM actual
            EXCEPT
            SELECT module_code, right_code FROM expected
        ) AS extra
    ) THEN
        RAISE EXCEPTION 'Rights catalogue does not match the guide 3.8 catalogue of 36 module/action pairs';
    END IF;

    SELECT count(*)
    INTO actual_right_count
    FROM public.rights_catalog;

    IF actual_right_count <> 36 THEN
        RAISE EXCEPTION 'Expected 36 rights, found %', actual_right_count;
    END IF;

    -- Guide 3.8 enumerates rights, not a default Admin/User role matrix.
    -- Seed default: Superadmin has all 36; Admin and User have no module rights
    -- until rights are granted per user through the Rights dialog.
    IF EXISTS (
        WITH expected_rights(module_code, right_code) AS (
            SELECT catalogue.module_code, action.right_code
            FROM (
                VALUES
                    ('customer', ARRAY['add_customer', 'edit_customer', 'delete_customer']),
                    ('product', ARRAY['add_product', 'edit_product', 'delete_product', 'add_price', 'edit_price', 'delete_price']),
                    ('human_resources', ARRAY['add_job', 'edit_job', 'delete_job', 'add_department', 'edit_department', 'delete_department', 'add_employee', 'edit_employee', 'delete_employee', 'view_job_history', 'add_job_history', 'edit_job_history', 'delete_job_history']),
                    ('sales', ARRAY['add_sale', 'edit_sale', 'delete_sale', 'view_sale_detail', 'add_sale_detail', 'edit_sale_detail', 'delete_sale_detail']),
                    ('reports', ARRAY['top_customers', 'product_master_list', 'top_products', 'active_employees', 'all_employees', 'employee_job_history', 'top_sales'])
            ) AS catalogue(module_code, right_codes)
            CROSS JOIN LATERAL unnest(catalogue.right_codes) AS action(right_code)
        ),
        expected(role_code, right_code) AS (
            SELECT r.role_code, er.right_code
            FROM public.app_role AS r
            CROSS JOIN expected_rights AS er
            WHERE r.role_code = 'superadmin'
        ),
        actual AS (
            SELECT r.role_code, rc.right_code
            FROM public.role_permission AS rp
            JOIN public.app_role AS r USING (role_id)
            JOIN public.rights_catalog AS rc USING (right_id)
        )
        SELECT role_code, right_code FROM (
            SELECT role_code, right_code FROM expected
            EXCEPT
            SELECT role_code, right_code FROM actual
        ) AS missing
        UNION ALL
        SELECT role_code, right_code FROM (
            SELECT role_code, right_code FROM actual
            EXCEPT
            SELECT role_code, right_code FROM expected
        ) AS extra
    ) THEN
        RAISE EXCEPTION 'Default role permissions do not match the seeded Superadmin-only matrix';
    END IF;
END $$;

-- Compare these counts with the approved team roster after invitations are sent.
-- No roster or password material is stored in this repository.
SELECT r.role_code, count(u.id) AS profile_count
FROM public.app_role AS r
LEFT JOIN public.app_user AS u USING (role_id)
GROUP BY r.role_code
ORDER BY r.role_code;
