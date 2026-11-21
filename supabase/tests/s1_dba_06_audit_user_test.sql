-- =====================================================================
-- S1-DBA-06  Tests for audit_user() / audit_log.action_by
--
-- Run it any of these ways:
--   * Supabase dashboard -> SQL Editor -> paste this file -> Run
--   * psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s1_dba_06_audit_user_test.sql
--
-- The whole run happens inside one transaction that is rolled back at the
-- end, so it never leaves rows behind. Every case prints PASS/FAIL, then a
-- result table is returned, and the script raises an exception if anything
-- failed (so psql exits non-zero and CI can gate on it).
--
-- What is proven:
--   1-5   audit_user() resolves the actor in the documented order
--   6-8   a real INSERT/UPDATE writes the logged-in user to audit_log
--         and to the stamp column
--   8     an email longer than action_by's 50 characters cannot break a write
--   9     an untrusted API role cannot spoof the actor via app.username
--   10-11 the function never returns NULL and stamp always fits its column
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS pg_temp._s1_dba_06_results;

CREATE TEMP TABLE pg_temp._s1_dba_06_results (
    id     INT  PRIMARY KEY,
    name   TEXT NOT NULL,
    ok     BOOLEAN NOT NULL,
    detail TEXT
);

CREATE OR REPLACE FUNCTION pg_temp.check(p_id INT, p_name TEXT, p_ok BOOLEAN, p_detail TEXT)
RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO pg_temp._s1_dba_06_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, ok = EXCLUDED.ok, detail = EXCLUDED.detail;
$$;

-- 1. Nothing supplied -> database login -------------------------------
SET LOCAL request.jwt.claims = '';
SET LOCAL app.username = '';
SELECT pg_temp.check(
    1,
    'falls back to the database login when no user is supplied',
    audit_user() = session_user::text,
    format('audit_user()=%s, session_user=%s', audit_user(), session_user));

-- 2. Explicit override for trusted sessions ---------------------------
SET LOCAL app.username = 'qa.explicit';
SELECT pg_temp.check(
    2,
    'explicit app.username override is honoured for trusted sessions',
    audit_user() = 'qa.explicit',
    format('audit_user()=%s', audit_user()));

-- 3. Logged-in user from the JWT email --------------------------------
SET LOCAL app.username = '';
SET LOCAL request.jwt.claims =
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"qa.user@hope.example","role":"authenticated"}';
SELECT pg_temp.check(
    3,
    'JWT email is used for the logged-in user',
    audit_user() = 'qa.user@hope.example',
    format('audit_user()=%s', audit_user()));

-- 4. Token without an email -> JWT subject ----------------------------
SET LOCAL request.jwt.claims =
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
SELECT pg_temp.check(
    4,
    'JWT sub is used when the token carries no email',
    audit_user() = '22222222-2222-4222-8222-222222222222',
    format('audit_user()=%s', audit_user()));

-- 5. Older single-claim settings still work ---------------------------
SET LOCAL request.jwt.claims = '';
SET LOCAL request.jwt.claim.email = 'legacy.claim@hope.example';
SELECT pg_temp.check(
    5,
    'older request.jwt.claim.email setting is still honoured',
    audit_user() = 'legacy.claim@hope.example',
    format('audit_user()=%s', audit_user()));
SET LOCAL request.jwt.claim.email = '';

-- 6. Real write path: INSERT ------------------------------------------
SET LOCAL request.jwt.claims =
    '{"sub":"33333333-3333-4333-8333-333333333333","email":"qa.trigger@hope.example","role":"authenticated"}';
INSERT INTO department (deptcode, deptname) VALUES ('QA9', 'QA Audit Trail');

SELECT pg_temp.check(
    6,
    'trigger records the logged-in user in audit_log.action_by',
    (SELECT action_by FROM audit_log
      WHERE table_name = 'department' AND record_key = 'QA9'
      ORDER BY audit_id DESC LIMIT 1) = 'qa.trigger@hope.example',
    format('action_by=%s',
           (SELECT action_by FROM audit_log
             WHERE table_name = 'department' AND record_key = 'QA9'
             ORDER BY audit_id DESC LIMIT 1)));

-- 7. The stamp column carries the same user ---------------------------
SELECT pg_temp.check(
    7,
    'stamp column also carries the logged-in user',
    (SELECT stamp FROM department WHERE deptcode = 'QA9')
        LIKE 'ADD qa.trigger@hope.example %',
    format('stamp=%s', (SELECT stamp FROM department WHERE deptcode = 'QA9')));

-- 8. Long email: truncated to 50 and the UPDATE still succeeds --------
SET LOCAL request.jwt.claims =
    '{"email":"very.long.audit.identity.address.for.testing@hope.example.com","role":"authenticated"}';
UPDATE department SET deptname = 'QA Audit Trail 2' WHERE deptcode = 'QA9';

SELECT pg_temp.check(
    8,
    'an actor longer than 50 characters is truncated and the write still succeeds',
    (SELECT action_by FROM audit_log
      WHERE table_name = 'department' AND record_key = 'QA9'
      ORDER BY audit_id DESC LIMIT 1)
        = left('very.long.audit.identity.address.for.testing@hope.example.com', 50),
    format('action_by=%s (length %s)',
           (SELECT action_by FROM audit_log
             WHERE table_name = 'department' AND record_key = 'QA9'
             ORDER BY audit_id DESC LIMIT 1),
           (SELECT length(action_by) FROM audit_log
             WHERE table_name = 'department' AND record_key = 'QA9'
             ORDER BY audit_id DESC LIMIT 1)));

-- 9. Public API roles cannot spoof app.username -----------------------
DO $$
DECLARE
    v_actor  TEXT;
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO v_exists;

    IF NOT v_exists THEN
        PERFORM pg_temp.check(9, 'public API roles cannot spoof app.username', TRUE,
                              'skipped: role authenticated does not exist on this database');
        RETURN;
    END IF;

    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('app.username', 'spoofed.by.client', true);
    PERFORM set_config('request.jwt.claims', '', true);
    v_actor := audit_user();
    PERFORM set_config('role', session_user, true);

    PERFORM pg_temp.check(
        9,
        'public API roles cannot spoof app.username',
        v_actor <> 'spoofed.by.client',
        format('audit_user() as authenticated=%s', v_actor));
END;
$$;

-- 10. Never NULL / blank ----------------------------------------------
SET LOCAL app.username = '';
SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
SELECT pg_temp.check(
    10,
    'audit_user() never returns NULL or a blank actor',
    audit_user() IS NOT NULL AND audit_user() <> '',
    format('audit_user()=%s', audit_user()));

-- 11. stamp always fits its column ------------------------------------
SELECT set_config('app.username', repeat('x', 80), true);
SELECT pg_temp.check(
    11,
    'stamp stays within VARCHAR(100) even with a very long actor',
    length(audit_stamp('EDIT')) <= 100,
    format('stamp length=%s, stamp=%s', length(audit_stamp('EDIT')), audit_stamp('EDIT')));

-- Report ---------------------------------------------------------------
DO $$
DECLARE
    r        RECORD;
    v_failed INT := 0;
    v_total  INT;
BEGIN
    SELECT count(*) INTO v_total FROM pg_temp._s1_dba_06_results;

    FOR r IN SELECT * FROM pg_temp._s1_dba_06_results ORDER BY id LOOP
        RAISE NOTICE '% T% - % (%)',
            CASE WHEN r.ok THEN 'PASS' ELSE 'FAIL' END,
            r.id, r.name, COALESCE(r.detail, '');
        IF NOT r.ok THEN
            v_failed := v_failed + 1;
        END IF;
    END LOOP;

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'S1-DBA-06: % of % tests failed', v_failed, v_total;
    END IF;

    RAISE NOTICE 'S1-DBA-06: all % tests passed', v_total;
END;
$$;

SELECT id AS "#",
       name AS test,
       CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result,
       detail AS observed
  FROM pg_temp._s1_dba_06_results
 ORDER BY id;

ROLLBACK;
