-- Server-side flows (for example blocking a user) update public.app_user with
-- the service-role key. The table's BEFORE UPDATE trigger lives in app_private
-- and calls helper functions there, so service_role needs schema usage and
-- execute privileges. Without this, admin updates fail with
-- "permission denied for schema app_private".

GRANT USAGE ON SCHEMA app_private TO service_role;

GRANT EXECUTE ON FUNCTION app_private.current_role_code() TO service_role;
GRANT EXECUTE ON FUNCTION app_private.can_manage_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.guard_app_user_update() TO service_role;
GRANT EXECUTE ON FUNCTION app_private.set_updated_at() TO service_role;
