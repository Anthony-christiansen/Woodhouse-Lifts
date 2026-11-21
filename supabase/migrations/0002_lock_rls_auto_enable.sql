-- Supabase's built-in rls_auto_enable() helper was callable over the API; lock it down.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
