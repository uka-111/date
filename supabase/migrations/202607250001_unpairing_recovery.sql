-- Preserve ended couples while allowing a user to have one active membership.
alter table public.couple_members
  add column if not exists left_at timestamptz;

do $$
declare
  v_constraint text;
begin
  select conname
  into v_constraint
  from pg_constraint
  where conrelid = 'public.couple_members'::regclass
    and contype = 'u'
    and conkey = array[
      (select attnum from pg_attribute
       where attrelid = 'public.couple_members'::regclass and attname = 'user_id')
    ];

  if v_constraint is not null then
    execute format('alter table public.couple_members drop constraint %I', v_constraint);
  end if;
end;
$$;

create unique index if not exists couple_members_one_active_per_user_idx
  on public.couple_members (user_id)
  where left_at is null;

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select cm.couple_id
  from public.couple_members as cm
  where cm.user_id = auth.uid()
    and cm.left_at is null
  limit 1;
$$;

create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = p_couple_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
  );
$$;

create or replace function public.create_couple_with_invite(
  p_identity public.partner_identity
)
returns table (
  couple_id uuid,
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
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_identity is null then raise exception 'Partner identity is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1 from public.couple_members
    where user_id = v_user_id and left_at is null
  ) then
    raise exception 'User already belongs to a couple';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found for authenticated user';
  end if;

  -- Reuse the most recent ended two-person couple for this user.
  select cm.couple_id
  into v_couple_id
  from public.couple_members as cm
  where cm.user_id = v_user_id
    and cm.left_at is not null
    and (
      select count(*) from public.couple_members as members
      where members.couple_id = cm.couple_id
    ) = 2
  order by cm.left_at desc
  limit 1
  for update;

  if v_couple_id is null then
    insert into public.couples (created_by)
    values (v_user_id)
    returning id into v_couple_id;

    insert into public.couple_members (couple_id, user_id, identity)
    values (v_couple_id, v_user_id, p_identity);
  else
    update public.couple_members as cm
    set left_at = null,
        identity = p_identity
    where cm.couple_id = v_couple_id and cm.user_id = v_user_id;
  end if;

  update public.couple_invites as ci
  set revoked_at = now()
  where ci.couple_id = v_couple_id and ci.used_at is null and ci.revoked_at is null;

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

  return query select v_couple_id, v_invite_code, v_expires_at;
end;
$$;

create or replace function public.redeem_couple_invite(p_invite_code text)
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
  v_couple_id uuid;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_revoked_at timestamptz;
  v_existing_user uuid;
  v_existing_identity public.partner_identity;
  v_new_identity public.partner_identity;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_normalized_code) <> 12 then raise exception 'Invite code unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (select 1 from public.couple_members where user_id = v_user_id and left_at is null) then
    raise exception 'Invite code unavailable';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Invite code unavailable';
  end if;

  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');
  select ci.id, ci.couple_id
  into v_invite_id, v_couple_id
  from public.couple_invites as ci
  where ci.code_hash = v_code_hash;
  if v_invite_id is null then
    raise exception 'Invite code unavailable';
  end if;

  perform 1
  from public.couples as c
  where c.id = v_couple_id
  for update;
  if not found then raise exception 'Invite code unavailable'; end if;

  select ci.expires_at, ci.used_at, ci.revoked_at
  into v_expires_at, v_used_at, v_revoked_at
  from public.couple_invites as ci
  where ci.id = v_invite_id
    and ci.couple_id = v_couple_id
    and ci.code_hash = v_code_hash
  for update;
  if not found or v_used_at is not null or v_revoked_at is not null or v_expires_at <= now() then
    raise exception 'Invite code unavailable';
  end if;

  select cm.user_id, cm.identity
  into v_existing_user, v_existing_identity
  from public.couple_members as cm
  where cm.couple_id = v_couple_id
  order by cm.joined_at
  limit 1;
  if v_existing_user is null or v_existing_identity is null then raise exception 'Invite code unavailable'; end if;

  -- An ended two-person couple can only be restored by its original partner.
  if (select count(*) from public.couple_members as members where members.couple_id = v_couple_id) = 2
    and not exists (
      select 1 from public.couple_members as members
      where members.couple_id = v_couple_id and members.user_id = v_user_id
    )
  then
    raise exception 'Invite code unavailable';
  end if;

  v_new_identity := case v_existing_identity
    when 'him'::public.partner_identity then 'her'::public.partner_identity
    else 'him'::public.partner_identity
  end;

  -- Restore the old member row when this is the same partner who left before.
  if exists (
    select 1 from public.couple_members as cm
    where cm.couple_id = v_couple_id and cm.user_id = v_user_id
  ) then
    update public.couple_members as cm
    set left_at = null, identity = v_new_identity
    where cm.couple_id = v_couple_id and cm.user_id = v_user_id;
  else
    insert into public.couple_members (couple_id, user_id, identity)
    values (v_couple_id, v_user_id, v_new_identity);
  end if;

  update public.couple_invites as ci
  set used_at = now(), used_by = v_user_id
  where ci.id = v_invite_id;

  return query select v_couple_id, v_new_identity;
end;
$$;

create or replace function public.leave_current_couple()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.couple_members
  set left_at = now()
  where user_id = auth.uid() and left_at is null;
end;
$$;

revoke all on function public.leave_current_couple() from public, anon;
grant execute on function public.leave_current_couple() to authenticated;
