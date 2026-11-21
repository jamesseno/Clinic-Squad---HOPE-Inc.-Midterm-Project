-- =====================================================================
-- S1-DBA-06  Make audit_user() record the logged-in user in audit_log
--
-- Problem
--   audit_user() only read the  app.username  setting and then fell back to
--   session_user.  Through Supabase every request arrives on the same
--   database role (anon / authenticated / service_role), so session_user is
--   never the person using the app and audit_log.action_by was written as
--   'authenticated' instead of the logged-in user.
--
-- Fix
--   Resolve the actor from the request JWT that Supabase/PostgREST already
--   verifies, first match wins:
--
--     1. app.username          explicit override for trusted SQL sessions
--                              (seeds, maintenance, tests). Ignored for the
--                              public API roles anon/authenticated, so a
--                              browser client cannot spoof the audit trail.
--     2. app_user.username     once the S1-DBA-03 table exists; the row for
--                              the JWT subject, which RLS exposes to that
--                              same user.
--     3. JWT email claim       the logged-in Supabase Auth user.
--     4. JWT sub claim         the auth user id (uuid) when no email.
--     5. session_user          psql, migrations, service role without a JWT.
--
--   The result is truncated to 50 characters so it always fits
--   audit_log.action_by VARCHAR(50).
--
-- Also fixed
--   stamp was VARCHAR(60) but a 50-character actor needs up to 78 characters
--   ('RESTORE ' + actor + ' ' + 'YYYY-MM-DD HH12:MI AM'). With emails in the
--   audit trail that would have aborted real writes, so stamp is widened to
--   VARCHAR(100) and audit_stamp() caps the actor at 50 characters.
--
-- Safe to run more than once.
-- =====================================================================

-- 1. Who is acting? ----------------------------------------------------
CREATE OR REPLACE FUNCTION audit_user() RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor  TEXT;
    v_uid    TEXT;
    v_email  TEXT;
    v_claims JSONB;
BEGIN
    -- 1. Explicit override for trusted sessions only:
    --        SET LOCAL app.username = 'someone';
    --    The public API roles are excluded so a client cannot forge the actor.
    IF current_user NOT IN ('anon', 'authenticated') THEN
        v_actor := NULLIF(btrim(current_setting('app.username', true)), '');
        IF v_actor IS NOT NULL THEN
            RETURN left(v_actor, 50);
        END IF;
    END IF;

    -- 2. The per-request JWT claims. PostgREST verifies the signature before
    --    setting this, so the value cannot be supplied by the caller.
    BEGIN
        v_claims := NULLIF(btrim(current_setting('request.jwt.claims', true)), '')::jsonb;
    EXCEPTION WHEN others THEN
        v_claims := NULL;                       -- malformed setting, ignore it
    END;

    IF v_claims IS NOT NULL THEN
        v_uid   := NULLIF(btrim(v_claims ->> 'sub'), '');
        v_email := NULLIF(btrim(v_claims ->> 'email'), '');
    END IF;

    -- Older PostgREST versions expose the claims one by one.
    IF v_uid IS NULL THEN
        v_uid := NULLIF(btrim(current_setting('request.jwt.claim.sub', true)), '');
    END IF;
    IF v_email IS NULL THEN
        v_email := NULLIF(btrim(current_setting('request.jwt.claim.email', true)), '');
    END IF;

    -- 3. Prefer the application username once app_user exists (S1-DBA-03).
    --    RLS only shows the caller their own row, which is the row we need.
    --    Any shape mismatch falls through to the email below.
    IF v_uid IS NOT NULL AND to_regclass('public.app_user') IS NOT NULL THEN
        BEGIN
            EXECUTE 'SELECT username FROM public.app_user WHERE id = $1 LIMIT 1'
               INTO v_actor
               USING v_uid::uuid;
        EXCEPTION WHEN others THEN
            v_actor := NULL;
        END;
        IF v_actor IS NOT NULL THEN
            RETURN left(v_actor, 50);
        END IF;
    END IF;

    -- 4./5. JWT identity, then the database login as a last resort.
    RETURN left(COALESCE(v_email, v_uid, session_user::text, 'unknown'), 50);
END;
$$;

COMMENT ON FUNCTION audit_user() IS
    'Acting user for audit_log.action_by and stamp: app.username override '
    '(trusted roles only), then app_user.username for the JWT subject, then '
    'the JWT email, the JWT sub, and finally session_user. Capped at 50 chars.';

-- 2. Stamp must be able to hold the longest possible actor ---------------
CREATE OR REPLACE FUNCTION audit_stamp(p_action TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT left(p_action, 7) || ' ' || left(audit_user(), 50) || ' ' ||
           to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM');
$$;

-- 78 characters maximum for the text above, so widen the column and the
-- auto-generated <table>_active views that select it.
DO $$
DECLARE
    r      RECORD;
    v_view TEXT;
BEGIN
    FOR r IN
        SELECT t.tbl
          FROM (VALUES ('employee'), ('department'), ('job'), ('jobhistory'),
                       ('customer'), ('sales'), ('salesdetail'), ('product'),
                       ('payment'), ('pricehist')) AS t(tbl)
         WHERE to_regclass('public.' || t.tbl) IS NOT NULL
    LOOP
        v_view := r.tbl || '_active';

        -- The read views are SELECT *, so they depend on stamp and block the
        -- type change. Recreate them exactly as the base migration defines
        -- them. Nothing grants on these views yet; if a later sprint does,
        -- that grant belongs in its own migration.
        IF to_regclass('public.' || v_view) IS NOT NULL THEN
            EXECUTE format('DROP VIEW public.%I', v_view);
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN stamp TYPE VARCHAR(100)', r.tbl);
            EXECUTE format('CREATE VIEW public.%I AS SELECT * FROM public.%I WHERE NOT is_deleted',
                           v_view, r.tbl);
        ELSE
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN stamp TYPE VARCHAR(100)', r.tbl);
        END IF;
    END LOOP;
END;
$$;
