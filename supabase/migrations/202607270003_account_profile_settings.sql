create or replace function public.update_my_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_display_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  v_display_name := nullif(
    btrim(left(btrim(regexp_replace(coalesce(p_display_name, ''), '[[:space:]]+', ' ', 'g')), 40)),
    ''
  );
  if v_display_name is null then raise exception 'Display name is required'; end if;

  update public.profiles
  set display_name = v_display_name, updated_at = now()
  where id = auth.uid()
  returning display_name into v_display_name;

  if v_display_name is null then raise exception 'Profile not found'; end if;
  return v_display_name;
end;
$$;

revoke all on function public.update_my_display_name(text) from public, anon;
grant execute on function public.update_my_display_name(text) to authenticated;
