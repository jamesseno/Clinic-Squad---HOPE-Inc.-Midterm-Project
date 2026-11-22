-- =====================================================================
-- S1-DEV-07  Regression tests for the rights dialog database layer
--
-- Covers public.set_user_rights(uuid, integer[]) and the
-- user_permission -> audit_log trigger added in
-- supabase/migrations/20261121130000_user_rights_audit_and_rpc.sql.
--
-- Run it any of these ways:
--   * Supabase dashboard -> SQL Editor -> paste this file -> Run
--   * psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s1_dev_07_user_rights_audit_test.sql
--
-- The whole run happens inside one transaction that is rolled back at the
-- end. Every case prints PASS/FAIL, a result table is returned, and the
-- script raises an exception if anything failed.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS pg_temp._s1_dev_07_results;

CREATE TEMP TABLE pg_temp._s1_dev_07_results (
    id     INT  PRIMARY KEY,
    name   TEXT NOT NULL,
    ok     BOOLEAN NOT NULL,
    detail TEXT
);

CREATE OR REPLACE FUNCTION pg_temp.check(p_id INT, p_name TEXT, p_ok BOOLEAN, p_detail TEXT)
RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO pg_temp._s1_dev_07_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, ok = EXCLUDED.ok, detail = EXCLUDED.detail;
$$;

-- Supabase already ships auth.users, so this stub is a no-op there. On a bare
-- Postgres instance it provides the parent row the app_user foreign key needs.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        CREATE SCHEMA auth;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users'
    ) THEN
        CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    END IF;
END;
$$;

-- Fixed identities used by the cases below.
--   manager  = active Admin
--   root     = active Superadmin
--   target   = active standard User (the account being edited)
--   target2  = active standard User (isolation check)
--   peer     = active Admin (must not be editable)
--   pending  = pending standard User
INSERT INTO auth.users (id, email) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'manager@hope.example'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'root@hope.example'),
    ('bbbbbbbb-0000-4000-8000-000000000001', 'target@hope.example'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'target2@hope.example'),
    ('cccccccc-0000-4000-8000-000000000001', 'peer@hope.example'),
    ('bbbbbbbb-0000-4000-8000-000000000003', 'pending@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (id, email, first_name, last_name, role_id, account_status, is_blocked)
SELECT v.id, v.email, v.first_name, v.last_name, r.role_id, v.account_status, false
  FROM (VALUES
        ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'manager@hope.example', 'Mia', 'Manager',  'admin',      'active'),
        ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'root@hope.example',    'Ria', 'Root',     'superadmin', 'active'),
        ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'target@hope.example',  'Tara', 'Target',  'user',       'active'),
        ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'target2@hope.example', 'Tina', 'Target',  'user',       'active'),
        ('cccccccc-0000-4000-8000-000000000001'::uuid, 'peer@hope.example',    'Pia', 'Peer',     'admin',      'active'),
        ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'pending@hope.example', 'Pia', 'Pending',  'user',       'pending')
       ) AS v(id, email, first_name, last_name, role_code, account_status)
  JOIN public.app_role AS r ON r.role_code = v.role_code
ON CONFLICT (id) DO UPDATE
   SET role_id = EXCLUDED.role_id,
       account_status = EXCLUDED.account_status,
       is_blocked = EXCLUDED.is_blocked;

-- Keep the audit actor deterministic: never use the trusted SQL override.
SET LOCAL app.username = '';

-- 1. Catalogue sanity ---------------------------------------------------
SELECT pg_temp.check(
    1,
    'catalogue still has five modules and 36 active rights',
    (SELECT count(*) FROM public.module WHERE is_active) = 5
    AND (SELECT count(*) FROM public.rights_catalog WHERE is_active) = 36,
    format('modules=%s, rights=%s',
           (SELECT count(*) FROM public.module WHERE is_active),
           (SELECT count(*) FROM public.rights_catalog WHERE is_active)));

-- The three Customer rights.
CREATE TEMP TABLE pg_temp._customer_rights AS
SELECT array_agg(right_id ORDER BY display_order) AS ids
  FROM public.rights_catalog
 WHERE module_id = (SELECT module_id FROM public.module WHERE module_code = 'customer');

-- 2. Admin grants three Customer rights --------------------------------
SET LOCAL request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"manager@hope.example","role":"authenticated"}';

SELECT public.set_user_rights(
    'bbbbbbbb-0000-4000-8000-000000000001',
    (SELECT ids FROM pg_temp._customer_rights));

SELECT pg_temp.check(
    2,
    'admin grants the three selected Customer rights',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted) = 3,
    format('active rows=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted)));

-- 3. Every grant is audited with the manager's identity ----------------
SELECT pg_temp.check(
    3,
    'each grant writes an ADD row attributed to the logged-in manager',
    (SELECT count(*) FROM public.audit_log
      WHERE table_name = 'user_permission'
        AND action = 'ADD'
        AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%'
        AND action_by = 'manager@hope.example') = 3,
    format('ADD rows=%s, action_by=%s',
           (SELECT count(*) FROM public.audit_log
             WHERE table_name = 'user_permission' AND action = 'ADD'),
           (SELECT string_agg(DISTINCT action_by, ',') FROM public.audit_log
             WHERE table_name = 'user_permission')));

-- 4. Revoke one right ---------------------------------------------------
SELECT public.set_user_rights(
    'bbbbbbbb-0000-4000-8000-000000000001',
    (SELECT ids[1:2] FROM pg_temp._customer_rights));

SELECT pg_temp.check(
    4,
    'removing one right soft-deletes it and writes a DELETE audit row',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted) = 2
    AND (SELECT count(*) FROM public.audit_log
          WHERE table_name = 'user_permission'
            AND action = 'DELETE'
            AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%'
            AND action_by = 'manager@hope.example') = 1,
    format('active rows=%s, DELETE rows=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted),
           (SELECT count(*) FROM public.audit_log
             WHERE table_name = 'user_permission' AND action = 'DELETE')));

-- 5. Re-grant the revoked right ----------------------------------------
SELECT public.set_user_rights(
    'bbbbbbbb-0000-4000-8000-000000000001',
    (SELECT ids FROM pg_temp._customer_rights));

SELECT pg_temp.check(
    5,
    're-granting a revoked right restores the row and writes a RESTORE audit row',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted) = 3
    AND (SELECT count(*) FROM public.audit_log
          WHERE table_name = 'user_permission'
            AND action = 'RESTORE'
            AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%'
            AND action_by = 'manager@hope.example') = 1,
    format('active rows=%s, RESTORE rows=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted),
           (SELECT count(*) FROM public.audit_log
             WHERE table_name = 'user_permission' AND action = 'RESTORE')));

-- 6. Saving the same selection is a no-op ------------------------------
SELECT public.set_user_rights(
    'bbbbbbbb-0000-4000-8000-000000000001',
    (SELECT ids FROM pg_temp._customer_rights));

SELECT pg_temp.check(
    6,
    'saving an unchanged selection writes no extra audit rows',
    (SELECT count(*) FROM public.audit_log
      WHERE table_name = 'user_permission'
        AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%') = 5,
    format('audit rows for target=%s',
           (SELECT count(*) FROM public.audit_log
             WHERE table_name = 'user_permission'
               AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%')));

-- 7. Clearing all rights ------------------------------------------------
SELECT public.set_user_rights('bbbbbbbb-0000-4000-8000-000000000001', '{}'::integer[]);

SELECT pg_temp.check(
    7,
    'clearing the selection soft-deletes every active right',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted) = 0
    AND (SELECT count(*) FROM public.audit_log
          WHERE table_name = 'user_permission'
            AND action = 'DELETE'
            AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%') = 4,
    format('active rows=%s, DELETE rows=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted),
           (SELECT count(*) FROM public.audit_log
             WHERE table_name = 'user_permission'
               AND action = 'DELETE'
               AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%')));

-- 8. Other users are untouched -----------------------------------------
SELECT pg_temp.check(
    8,
    'rights changes do not leak into another standard user',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0,
    format('other user rows=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000002')));

-- 9. Superadmin may also manage a standard user ------------------------
SET LOCAL request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","email":"root@hope.example","role":"authenticated"}';

SELECT public.set_user_rights(
    'bbbbbbbb-0000-4000-8000-000000000001',
    (SELECT ids[1:1] FROM pg_temp._customer_rights));

SELECT pg_temp.check(
    9,
    'superadmin can grant a right to a standard user',
    (SELECT count(*) FROM public.user_permission
      WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted) = 1
    AND (SELECT action_by FROM public.audit_log
          WHERE table_name = 'user_permission'
            AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%'
          ORDER BY audit_id DESC LIMIT 1) = 'root@hope.example',
    format('active rows=%s, latest actor=%s',
           (SELECT count(*) FROM public.user_permission
             WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000001' AND NOT is_deleted),
           (SELECT action_by FROM public.audit_log
             WHERE table_name = 'user_permission'
               AND record_key LIKE 'bbbbbbbb-0000-4000-8000-000000000001|%'
             ORDER BY audit_id DESC LIMIT 1)));

-- 10. Guards: standard user, peer admin, pending target, bad right -----
DO $$
DECLARE
    v_state  TEXT;
    v_right  INT;
BEGIN
    -- Standard user cannot call the RPC.
    PERFORM set_config('request.jwt.claims',
        '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","email":"target@hope.example","role":"authenticated"}', true);
    BEGIN
        PERFORM public.set_user_rights('bbbbbbbb-0000-4000-8000-000000000001', '{}'::integer[]);
        v_state := 'NO_ERROR';
    EXCEPTION WHEN others THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    END;
    PERFORM pg_temp.check(10, 'standard user cannot change rights', v_state = '42501',
                          format('sqlstate=%s', v_state));

    -- Admin cannot edit another Admin.
    PERFORM set_config('request.jwt.claims',
        '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"manager@hope.example","role":"authenticated"}', true);
    BEGIN
        PERFORM public.set_user_rights('cccccccc-0000-4000-8000-000000000001', '{}'::integer[]);
        v_state := 'NO_ERROR';
    EXCEPTION WHEN others THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    END;
    PERFORM pg_temp.check(11, 'admin cannot edit another admin', v_state = '42501',
                          format('sqlstate=%s', v_state));

    -- Pending standard user cannot be edited.
    BEGIN
        PERFORM public.set_user_rights('bbbbbbbb-0000-4000-8000-000000000003', '{}'::integer[]);
        v_state := 'NO_ERROR';
    EXCEPTION WHEN others THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    END;
    PERFORM pg_temp.check(12, 'pending user cannot receive rights', v_state = '42501',
                          format('sqlstate=%s', v_state));

    -- Unknown right id is rejected.
    SELECT COALESCE(max(right_id), 0) + 999 INTO v_right FROM public.rights_catalog;
    BEGIN
        PERFORM public.set_user_rights('bbbbbbbb-0000-4000-8000-000000000001', ARRAY[v_right]);
        v_state := 'NO_ERROR';
    EXCEPTION WHEN others THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    END;
    PERFORM pg_temp.check(13, 'unknown right ids are rejected', v_state = '22023',
                          format('sqlstate=%s, right_id=%s', v_state, v_right));
END;
$$;

-- 14. All changes remain attributed to a real actor --------------------
SELECT pg_temp.check(
    14,
    'every user_permission audit row names the acting manager, never a DB role',
    (SELECT count(*) FROM public.audit_log
      WHERE table_name = 'user_permission'
        AND action_by IN ('postgres', 'authenticated', 'anon', 'service_role')) = 0
    AND (SELECT count(*) FROM public.audit_log
          WHERE table_name = 'user_permission') > 0,
    format('rows=%s, actors=%s',
           (SELECT count(*) FROM public.audit_log WHERE table_name = 'user_permission'),
           (SELECT string_agg(DISTINCT action_by, ',') FROM public.audit_log
             WHERE table_name = 'user_permission')));

-- Report ---------------------------------------------------------------
DO $$
DECLARE
    r        RECORD;
    v_failed INT := 0;
    v_total  INT;
BEGIN
    SELECT count(*) INTO v_total FROM pg_temp._s1_dev_07_results;

    FOR r IN SELECT * FROM pg_temp._s1_dev_07_results ORDER BY id LOOP
        RAISE NOTICE '% T% - % (%)',
            CASE WHEN r.ok THEN 'PASS' ELSE 'FAIL' END,
            r.id, r.name, COALESCE(r.detail, '');
        IF NOT r.ok THEN
            v_failed := v_failed + 1;
        END IF;
    END LOOP;

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'S1-DEV-07: % of % tests failed', v_failed, v_total;
    END IF;

    RAISE NOTICE 'S1-DEV-07: all % tests passed', v_total;
END;
$$;

SELECT id AS "#",
       name AS test,
       CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result,
       detail AS observed
  FROM pg_temp._s1_dev_07_results
 ORDER BY id;

ROLLBACK;
