-- Regeneration must ignore historical memberships retained for recovery.
create or replace function public.regenerate_couple_invite()
returns table (
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_invite_code text;
  v_random_bytes bytea;
  v_byte_index integer;
  v_member_count integer;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select cm.couple_id
  into v_couple_id
  from public.couple_members as cm
  where cm.user_id = v_user_id
    and cm.left_at is null
  for update;

  if v_couple_id is null then
    raise exception 'User does not belong to a couple';
  end if;

  perform 1
  from public.couples as c
  where c.id = v_couple_id
  for update;

  select count(*)::integer
  into v_member_count
  from public.couple_members as cm
  where cm.couple_id = v_couple_id
    and cm.left_at is null;

  if v_member_count >= 2 then
    raise exception 'Couple already has two members';
  end if;

  update public.couple_invites as ci
  set revoked_at = now()
  where ci.couple_id = v_couple_id
    and ci.used_at is null
    and ci.revoked_at is null;

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

    insert into public.couple_invites (couple_id, code_hash, created_by, expires_at)
    values (
      v_couple_id,
      encode(extensions.digest(v_invite_code, 'sha256'), 'hex'),
      v_user_id,
      v_expires_at
    )
    on conflict (code_hash) do nothing;

    exit when found;
  end loop;

  return query select v_invite_code, v_expires_at;
end;
$$;

revoke all on function public.regenerate_couple_invite() from public, anon;
grant execute on function public.regenerate_couple_invite() to authenticated;
