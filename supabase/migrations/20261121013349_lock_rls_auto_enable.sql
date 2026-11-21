-- Supabase's built-in rls_auto_enable() helper was callable over the API; lock it down.
-- Conditional so the migration also runs on a fresh/local database where the helper doesn't exist.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
