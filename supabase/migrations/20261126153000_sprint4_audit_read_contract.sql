-- Limit direct authenticated access to audit metadata. The JSON snapshot
-- columns are available only through the filtered, redacted Superadmin view.

CREATE OR REPLACE FUNCTION app_private.redact_audit_values(p_values jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_values IS NULL THEN NULL
        WHEN jsonb_typeof(p_values) = 'object' THEN COALESCE(
            (
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(p_values) AS entry
                WHERE lower(entry.key) NOT IN (
                    'password',
                    'password_hash',
                    'token',
                    'token_hash',
                    'access_token',
                    'refresh_token',
                    'service_role_key',
                    'secret',
                    'secret_key',
                    'api_key',
                    'client_secret',
                    'authorization',
                    'authorization_header'
                )
            ),
            '{}'::jsonb
        )
        ELSE p_values
    END
$$;

REVOKE ALL ON FUNCTION app_private.redact_audit_values(jsonb) FROM PUBLIC;

CREATE OR REPLACE VIEW public.audit_log_superadmin
    WITH (security_barrier = true)
AS
SELECT
    al.audit_id,
    al.table_name,
    al.action,
    al.record_key,
    app_private.redact_audit_values(al.old_values) AS old_values,
    app_private.redact_audit_values(al.new_values) AS new_values,
    al.action_by,
    al.action_at
FROM public.audit_log AS al
WHERE app_private.current_role_code() = 'superadmin'
  AND app_private.has_right('view_audit_log');

-- Keep row-filtered access to safe metadata on the base table, while making
-- the snapshot columns available only through audit_log_superadmin.
REVOKE SELECT ON TABLE public.audit_log FROM authenticated;
GRANT SELECT (
    audit_id,
    table_name,
    action,
    record_key,
    action_by,
    action_at
) ON TABLE public.audit_log TO authenticated;
GRANT SELECT ON public.audit_log_superadmin TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log
    FROM anon, authenticated;
