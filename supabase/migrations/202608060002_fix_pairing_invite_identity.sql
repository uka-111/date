-- Keep the selected identity when the creator has no active membership yet.
create or replace function public.create_pairing_invite(
  p_identity public.partner_identity
)
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_identity public.partner_identity := p_identity;
  v_existing_identity public.partner_identity;
  v_active_couple_id uuid;
  v_active_member_count integer;
  v_invite_code text;
  v_random_bytes bytea;
  v_byte_index integer;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found for authenticated user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select cm.couple_id, cm.identity
  into v_active_couple_id, v_existing_identity
  from public.couple_members as cm
  where cm.user_id = v_user_id and cm.left_at is null
  limit 1
  for update;

  v_identity := coalesce(v_existing_identity, p_identity);

  select count(*)::integer
  into v_active_member_count
  from public.couple_members as cm
  where cm.couple_id = v_active_couple_id and cm.left_at is null;

  if v_active_member_count >= 2 then
    raise exception 'User already belongs to a couple';
  end if;
  if v_identity is null then raise exception 'Partner identity is required'; end if;

  update public.pairing_invites
  set revoked_at = now()
  where created_by = v_user_id and used_at is null and revoked_at is null;

  loop
    v_random_bytes := extensions.gen_random_bytes(12);
    v_invite_code := '';
    for v_byte_index in 0..11 loop
      v_invite_code := v_invite_code || substr(
        '23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
        (get_byte(v_random_bytes, v_byte_index) % 32) + 1,
        1
      );
    end loop;

    insert into public.pairing_invites (created_by, code_hash, expires_at, creator_identity)
    values (
      v_user_id,
      encode(extensions.digest(v_invite_code, 'sha256'), 'hex'),
      v_expires_at,
      v_identity
    )
    on conflict (code_hash) do nothing;
    exit when found;
  end loop;

  return query select v_invite_code, v_expires_at;
end;
$$;

revoke all on function public.create_pairing_invite(public.partner_identity) from public, anon;
grant execute on function public.create_pairing_invite(public.partner_identity) to authenticated;
