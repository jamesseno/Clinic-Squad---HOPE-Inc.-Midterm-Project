-- =====================================================================
-- S1-DEV-07  Rights dialog: per-action rights by module
--
-- What this adds
--   1. Every change to public.user_permission is written to public.audit_log.
--      A grant is ADD, a revoke is DELETE (soft delete), and re-granting a
--      previously revoked right is RESTORE. The actor comes from audit_user(),
--      so the row names the logged-in manager, not the shared DB role.
--   2. public.set_user_rights(user_id, right_ids) applies a whole selection
--      in one transaction. The dialog sends the complete set of checked
--      rights; the function diffs it against the current rows and inserts,
--      restores, or soft-deletes only what changed.
--
-- Guardrails (also enforced in the API route)
--   * The caller must be an active, unblocked Admin or Superadmin.
--   * The target must be an active, unblocked standard User account.
--     Admin and Superadmin accounts keep their role-based access.
--   * Only active rights from active modules can be granted.
--
-- Safe to run more than once.
-- =====================================================================

-- 1. Audit every user_permission change ---------------------------------
CREATE OR REPLACE FUNCTION app_private.audit_user_permission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_action TEXT;
    v_key    TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'ADD';
    ELSIF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
        v_action := CASE WHEN NEW.is_deleted THEN 'DELETE' ELSE 'RESTORE' END;
    ELSE
        v_action := 'EDIT';
    END IF;

    -- user_id (36) + '|' + right_id fits comfortably in record_key VARCHAR(60).
    v_key := NEW.user_id::text || '|' || NEW.right_id::text;

    INSERT INTO public.audit_log (
        table_name,
        action,
        record_key,
        old_values,
        new_values,
        action_by
    )
    VALUES (
        'user_permission',
        v_action,
        v_key,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        to_jsonb(NEW),
        public.audit_user()
    );

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION app_private.audit_user_permission_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS user_permission_aiu_audit ON public.user_permission;
CREATE TRIGGER user_permission_aiu_audit
    AFTER INSERT OR UPDATE ON public.user_permission
    FOR EACH ROW EXECUTE FUNCTION app_private.audit_user_permission_change();

-- 2. Apply a complete rights selection atomically -----------------------
CREATE OR REPLACE FUNCTION public.set_user_rights(
    p_user_id   uuid,
    p_right_ids integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor          uuid := auth.uid();
    v_target_role    text;
    v_target_status  text;
    v_target_blocked boolean;
    v_revoked        integer := 0;
    v_restored       integer := 0;
    v_added          integer := 0;
    v_selected       integer[];
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT app_private.can_manage_user(p_user_id) THEN
        RAISE EXCEPTION 'You cannot manage rights for this user.'
            USING ERRCODE = '42501';
    END IF;

    SELECT r.role_code, u.account_status, u.is_blocked
      INTO v_target_role, v_target_status, v_target_blocked
      FROM public.app_user AS u
      JOIN public.app_role AS r USING (role_id)
     WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_target_role <> 'user' THEN
        RAISE EXCEPTION 'Rights can only be managed for standard User accounts.'
            USING ERRCODE = '42501';
    END IF;

    IF v_target_status <> 'active' OR v_target_blocked THEN
        RAISE EXCEPTION 'Rights can only be managed for active, unblocked accounts.'
            USING ERRCODE = '42501';
    END IF;

    -- Normalise the selection and reject anything outside the active catalogue.
    SELECT COALESCE(array_agg(DISTINCT r.rid ORDER BY r.rid), '{}'::integer[])
      INTO v_selected
      FROM unnest(COALESCE(p_right_ids, '{}'::integer[])) AS r(rid);

    IF EXISTS (
        SELECT 1
          FROM unnest(v_selected) AS r(rid)
          LEFT JOIN public.rights_catalog AS rc ON rc.right_id = r.rid
          LEFT JOIN public.module AS m ON m.module_id = rc.module_id
         WHERE rc.right_id IS NULL
            OR NOT rc.is_active
            OR m.module_id IS NULL
            OR NOT m.is_active
    ) THEN
        RAISE EXCEPTION 'One or more selected rights are not available.'
            USING ERRCODE = '22023';
    END IF;

    -- Revoke checked-off rights that are currently active.
    WITH changed AS (
        UPDATE public.user_permission AS up
           SET is_deleted = true,
               deleted_at = now()
         WHERE up.user_id = p_user_id
           AND NOT up.is_deleted
           AND NOT (up.right_id = ANY (v_selected))
        RETURNING 1
    )
    SELECT count(*) INTO v_revoked FROM changed;

    -- Re-grant previously revoked rights that are checked again.
    WITH changed AS (
        UPDATE public.user_permission AS up
           SET is_deleted = false,
               deleted_at = NULL
         WHERE up.user_id = p_user_id
           AND up.is_deleted
           AND up.right_id = ANY (v_selected)
        RETURNING 1
    )
    SELECT count(*) INTO v_restored FROM changed;

    -- Insert rights that have never had a row for this user.
    WITH changed AS (
        INSERT INTO public.user_permission (user_id, right_id)
        SELECT p_user_id, r.rid
          FROM unnest(v_selected) AS r(rid)
         WHERE NOT EXISTS (
             SELECT 1
               FROM public.user_permission AS up
              WHERE up.user_id = p_user_id
                AND up.right_id = r.rid
         )
        RETURNING 1
    )
    SELECT count(*) INTO v_added FROM changed;

    RETURN jsonb_build_object(
        'granted', v_added + v_restored,
        'revoked', v_revoked,
        'total',
            (SELECT count(*)
               FROM public.user_permission
              WHERE user_id = p_user_id
                AND NOT is_deleted)
    );
END;
$$;

COMMENT ON FUNCTION public.set_user_rights(uuid, integer[]) IS
    'Replace a standard User''s active module rights in one transaction. '
    'Managers only; every change is audited in audit_log (S1-DEV-07).';

REVOKE ALL ON FUNCTION public.set_user_rights(uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_rights(uuid, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_rights(uuid, integer[]) TO service_role;
