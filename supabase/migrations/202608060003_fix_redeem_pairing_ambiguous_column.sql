-- Qualify the historical membership lookup so couple_id cannot resolve to the return column.
create or replace function public.redeem_pairing_invite(p_invite_code text)
returns table (couple_id uuid, identity public.partner_identity)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := upper(btrim(coalesce(p_invite_code, '')));
  v_code_hash text;
  v_invite_id uuid;
  v_inviter_id uuid;
  v_creator_identity public.partner_identity;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_revoked_at timestamptz;
  v_target_couple_id uuid;
  v_new_couple_id uuid;
  v_new_identity public.partner_identity;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_normalized_code) <> 12 then raise exception 'Invite code unavailable'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Invite code unavailable';
  end if;

  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');
  select pi.id, pi.created_by, pi.creator_identity, pi.expires_at, pi.used_at, pi.revoked_at
  into v_invite_id, v_inviter_id, v_creator_identity, v_expires_at, v_used_at, v_revoked_at
  from public.pairing_invites as pi
  where pi.code_hash = v_code_hash
  for update;
  if not found or v_used_at is not null or v_revoked_at is not null or v_expires_at <= now() then
    raise exception 'Invite code unavailable';
  end if;
  if v_inviter_id = v_user_id then raise exception 'Invite code unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(v_user_id::text, v_inviter_id::text) || ':' || greatest(v_user_id::text, v_inviter_id::text),
    0
  ));

  if exists (
    select 1 from public.couple_members as cm
    where cm.user_id = v_user_id and cm.left_at is null
    group by cm.user_id
    having count(*) >= 1
  ) then
    if exists (
      select 1 from public.couple_members as cm
      where cm.user_id = v_user_id and cm.left_at is null
      group by cm.user_id
      having count(*) >= 2
    ) then
      raise exception 'Invite code unavailable';
    end if;
  end if;

  select first_member.couple_id
  into v_target_couple_id
  from public.couple_members as first_member
  join public.couple_members as second_member
    on second_member.couple_id = first_member.couple_id
   and second_member.user_id = v_user_id
  where first_member.user_id = v_inviter_id
    and (
      select count(*)
      from public.couple_members as historical_member
      where historical_member.couple_id = first_member.couple_id
    ) = 2
  order by first_member.joined_at desc
  limit 1;

  if v_target_couple_id is not null then
    perform 1 from public.couples where id = v_target_couple_id for update;

    update public.couple_members
    set left_at = now()
    where user_id in (v_inviter_id, v_user_id)
      and left_at is null
      and couple_id <> v_target_couple_id;

    update public.couple_members
    set left_at = null
    where couple_id = v_target_couple_id
      and user_id in (v_inviter_id, v_user_id);

    select cm.identity
    into v_new_identity
    from public.couple_members as cm
    where cm.couple_id = v_target_couple_id and cm.user_id = v_user_id;
  else
    update public.couple_members
    set left_at = now()
    where user_id in (v_inviter_id, v_user_id) and left_at is null;

    insert into public.couples (created_by)
    values (v_inviter_id)
    returning id into v_new_couple_id;

    insert into public.couple_members (couple_id, user_id, identity)
    values (v_new_couple_id, v_inviter_id, v_creator_identity);

    v_new_identity := case v_creator_identity
      when 'him'::public.partner_identity then 'her'::public.partner_identity
      else 'him'::public.partner_identity
    end;

    insert into public.couple_members (couple_id, user_id, identity)
    values (v_new_couple_id, v_user_id, v_new_identity);
    v_target_couple_id := v_new_couple_id;
  end if;

  update public.pairing_invites
  set used_at = now(), used_by = v_user_id
  where id = v_invite_id;

  return query select v_target_couple_id, v_new_identity;
end;
$$;

revoke all on function public.redeem_pairing_invite(text) from public, anon;
grant execute on function public.redeem_pairing_invite(text) to authenticated;
