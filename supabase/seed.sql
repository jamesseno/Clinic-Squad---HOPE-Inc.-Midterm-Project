INSERT INTO public.app_role (role_code, role_name, description)
VALUES
    ('superadmin', 'Superadmin', 'Full access to all modules and actions.'),
    ('admin', 'Admin', 'Manages users and has full Customer, Product, and Price access.'),
    ('user', 'User', 'Standard account; module rights are granted per user.')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name,
    description = EXCLUDED.description;

INSERT INTO public.module (
    module_code,
    module_name,
    description,
    display_order,
    is_active
)
VALUES
    ('customer', 'Customer', 'Customer records and saved customer data.', 1, true),
    ('product', 'Product', 'Product records and saved product data.', 2, true),
    ('human_resources', 'Human Resources', 'Human resources records.', 3, true),
    ('sales', 'Sales', 'Sales records and transactions.', 4, true),
    ('reports', 'Reports', 'Saved reports and report outputs.', 5, true)
ON CONFLICT (module_code) DO UPDATE
SET module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Exact per-action catalogue from the HOPE Sprint 1 From-Scratch Guide, section 3.8
-- (printed pages 12-13): 3 Customer + 6 Product + 13 Human Resources +
-- 7 Sales + 7 Reports = 36 rights.
WITH module_rights (module_code, right_code, right_name, display_order) AS (
    VALUES
        ('customer', 'add_customer', 'Add Customer', 1),
        ('customer', 'edit_customer', 'Edit Customer', 2),
        ('customer', 'delete_customer', 'Delete Customer', 3),

        ('product', 'add_product', 'Add Product', 1),
        ('product', 'edit_product', 'Edit Product', 2),
        ('product', 'delete_product', 'Delete Product', 3),
        ('product', 'add_price', 'Add Price', 4),
        ('product', 'edit_price', 'Edit Price', 5),
        ('product', 'delete_price', 'Delete Price', 6),

        ('human_resources', 'add_job', 'Add Job', 1),
        ('human_resources', 'edit_job', 'Edit Job', 2),
        ('human_resources', 'delete_job', 'Delete Job', 3),
        ('human_resources', 'add_department', 'Add Department', 4),
        ('human_resources', 'edit_department', 'Edit Department', 5),
        ('human_resources', 'delete_department', 'Delete Department', 6),
        ('human_resources', 'add_employee', 'Add Employee', 7),
        ('human_resources', 'edit_employee', 'Edit Employee', 8),
        ('human_resources', 'delete_employee', 'Delete Employee', 9),
        ('human_resources', 'view_job_history', 'View Job History', 10),
        ('human_resources', 'add_job_history', 'Add Job History', 11),
        ('human_resources', 'edit_job_history', 'Edit Job History', 12),
        ('human_resources', 'delete_job_history', 'Delete Job History', 13),

        ('sales', 'add_sale', 'Add Sale', 1),
        ('sales', 'edit_sale', 'Edit Sale', 2),
        ('sales', 'delete_sale', 'Delete Sale', 3),
        ('sales', 'view_sale_detail', 'View Sale Detail', 4),
        ('sales', 'add_sale_detail', 'Add Sale Detail', 5),
        ('sales', 'edit_sale_detail', 'Edit Sale Detail', 6),
        ('sales', 'delete_sale_detail', 'Delete Sale Detail', 7),

        ('reports', 'top_customers', 'Top Customers', 1),
        ('reports', 'product_master_list', 'Product Master List', 2),
        ('reports', 'top_products', 'Top Products', 3),
        ('reports', 'active_employees', 'Active Employees', 4),
        ('reports', 'all_employees', 'All Employees', 5),
        ('reports', 'employee_job_history', 'Employee Job History', 6),
        ('reports', 'top_sales', 'Top Sales', 7)
)
INSERT INTO public.rights_catalog (
    module_id,
    right_code,
    right_name,
    description,
    display_order,
    is_active
)
SELECT
    m.module_id,
    mr.right_code,
    mr.right_name,
    mr.right_name || ' action for the ' || m.module_name || ' module.',
    mr.display_order,
    true
FROM module_rights AS mr
JOIN public.module AS m ON m.module_code = mr.module_code
ON CONFLICT (module_id, right_code) DO UPDATE
SET right_name = EXCLUDED.right_name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Sprint 2 grants Admin the full Customer, Product, and Price action set.
-- Other Admin/User module rights remain individually assigned. Individual
-- user_permission rows are never touched by this seed.
DELETE FROM public.role_permission AS rp
USING public.app_role AS r
WHERE rp.role_id = r.role_id
  AND r.role_code NOT IN ('superadmin', 'admin');

DELETE FROM public.role_permission AS rp
USING public.app_role AS r,
      public.rights_catalog AS rc,
      public.module AS m
WHERE rp.role_id = r.role_id
  AND rp.right_id = rc.right_id
  AND rc.module_id = m.module_id
  AND r.role_code = 'admin'
  AND m.module_code NOT IN ('customer', 'product');

INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role AS r
CROSS JOIN public.rights_catalog AS rc
WHERE r.role_code = 'superadmin'
ON CONFLICT (role_id, right_id) DO NOTHING;

INSERT INTO public.role_permission (role_id, right_id)
SELECT r.role_id, rc.right_id
FROM public.app_role AS r
JOIN public.module AS m
  ON m.module_code IN ('customer', 'product')
JOIN public.rights_catalog AS rc
  ON rc.module_id = m.module_id
WHERE r.role_code = 'admin'
ON CONFLICT (role_id, right_id) DO NOTHING;
