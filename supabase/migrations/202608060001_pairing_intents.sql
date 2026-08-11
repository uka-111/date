-- Decide whether to restore history or create a new couple only after both users are known.
create table if not exists public.pairing_invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  creator_identity public.partner_identity not null
);

create unique index if not exists pairing_invites_one_unused_per_creator_idx
  on public.pairing_invites (created_by)
  where used_at is null and revoked_at is null;

alter table public.pairing_invites enable row level security;
revoke all on table public.pairing_invites from public, anon, authenticated;

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
  into v_active_couple_id, v_identity
  from public.couple_members as cm
  where cm.user_id = v_user_id and cm.left_at is null
  limit 1
  for update;

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

create or replace function public.regenerate_couple_invite()
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_identity public.partner_identity;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select cm.identity
  into v_identity
  from public.couple_members as cm
  where cm.user_id = v_user_id and cm.left_at is null
  limit 1;
  if v_identity is null then raise exception 'User does not belong to a couple'; end if;

  return query select * from public.create_pairing_invite(v_identity);
end;
$$;

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
    -- A one-member waiting space can be left safely when this invite targets a new pair.
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
    and (select count(*) from public.couple_members where couple_id = first_member.couple_id) = 2
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

revoke all on function public.create_pairing_invite(public.partner_identity) from public, anon;
grant execute on function public.create_pairing_invite(public.partner_identity) to authenticated;
revoke all on function public.regenerate_couple_invite() from public, anon;
grant execute on function public.regenerate_couple_invite() to authenticated;
revoke all on function public.redeem_pairing_invite(text) from public, anon;
grant execute on function public.redeem_pairing_invite(text) to authenticated;

update public.couple_invites
set revoked_at = coalesce(revoked_at, now())
where used_at is null and revoked_at is null;

