-- Job History is sensitive HR data. Write/delete rights do not imply the
-- explicit View Job History read permission.

DROP POLICY IF EXISTS jobhistory_read ON public.jobhistory;
CREATE POLICY jobhistory_read
    ON public.jobhistory
    FOR SELECT
    TO authenticated
    USING (
        app_private.has_right('view_job_history')
        AND (
            NOT is_deleted
            OR app_private.has_right('delete_job_history')
        )
    );
