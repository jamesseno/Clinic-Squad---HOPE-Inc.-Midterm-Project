-- Parser-safe checks for S1-DEV-02. Select queries only; no functions,
-- triggers, policies, or comments are required to run this file.

select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'app_user'
  and column_name in ('account_status', 'role_id', 'is_blocked')
order by column_name;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.app_user'::regclass;

select role_id, role_code
from public.app_role
where role_code = 'user';

select id, email, first_name, last_name, account_status, created_at
from public.app_user
where email = 's1dev02-demo@gmail.com';
