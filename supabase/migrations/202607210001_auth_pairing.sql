create extension if not exists pgcrypto with schema extensions;

create type public.partner_identity as enum ('him', 'her');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 40
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  identity public.partner_identity not null,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (couple_id, identity)
);

create table public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index couple_invites_one_unused_per_couple_idx
  on public.couple_invites (couple_id)
  where used_at is null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  if v_display_name is null then
    v_display_name := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
  end if;

  v_display_name := left(coalesce(v_display_name, 'User'), 40);

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
grant execute on function public.handle_new_user_profile() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

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
  limit 1;
$$;

revoke all on function public.current_couple_id() from public, anon;
grant execute on function public.current_couple_id() to authenticated;

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
  );
$$;

revoke all on function public.is_couple_member(uuid) from public, anon;
grant execute on function public.is_couple_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (profiles.id = auth.uid());

create policy couples_select_own
  on public.couples
  for select
  to authenticated
  using (couples.id = public.current_couple_id());

create policy couple_members_select_own_couple
  on public.couple_members
  for select
  to authenticated
  using (couple_members.couple_id = public.current_couple_id());

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
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_identity is null then
    raise exception 'Partner identity is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1
    from public.couple_members as cm
    where cm.user_id = v_user_id
  ) then
    raise exception 'User already belongs to a couple';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
  ) then
    raise exception 'Profile not found for authenticated user';
  end if;

  insert into public.couples as c (created_by)
  values (v_user_id)
  returning c.id into v_couple_id;

  insert into public.couple_members (couple_id, user_id, identity)
  values (v_couple_id, v_user_id, p_identity);

  update public.couple_invites as ci
  set used_at = now()
  where ci.couple_id = v_couple_id
    and ci.used_at is null;

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

    insert into public.couple_invites (
      couple_id,
      code_hash,
      created_by,
      expires_at
    )
    values (
      v_couple_id,
      encode(extensions.digest(v_invite_code, 'sha256'), 'hex'),
      v_user_id,
      v_expires_at
    )
    on conflict (code_hash) do nothing;

    exit when found;
  end loop;

  return query
  select v_couple_id, v_invite_code, v_expires_at;
end;
$$;

revoke all on function public.create_couple_with_invite(public.partner_identity) from public, anon;
grant execute on function public.create_couple_with_invite(public.partner_identity) to authenticated;

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
  where cm.couple_id = v_couple_id;

  if v_member_count >= 2 then
    raise exception 'Couple already has two members';
  end if;

  update public.couple_invites as ci
  set used_at = now()
  where ci.couple_id = v_couple_id
    and ci.used_at is null;

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

    insert into public.couple_invites (
      couple_id,
      code_hash,
      created_by,
      expires_at
    )
    values (
      v_couple_id,
      encode(extensions.digest(v_invite_code, 'sha256'), 'hex'),
      v_user_id,
      v_expires_at
    )
    on conflict (code_hash) do nothing;

    exit when found;
  end loop;

  return query
  select v_invite_code, v_expires_at;
end;
$$;

revoke all on function public.regenerate_couple_invite() from public, anon;
grant execute on function public.regenerate_couple_invite() to authenticated;

create or replace function public.redeem_couple_invite(
  p_invite_code text
)
returns table (
  couple_id uuid,
  identity public.partner_identity
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text;
  v_code_hash text;
  v_invite_id uuid;
  v_couple_id uuid;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_existing_identity public.partner_identity;
  v_new_identity public.partner_identity;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_normalized_code := upper(btrim(coalesce(p_invite_code, '')));

  if char_length(v_normalized_code) <> 12 then
    raise exception 'Invalid invite code';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1
    from public.couple_members as cm
    where cm.user_id = v_user_id
  ) then
    raise exception 'User already belongs to a couple';
  end if;

  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');

  select ci.id, ci.couple_id
  into v_invite_id, v_couple_id
  from public.couple_invites as ci
  where ci.code_hash = v_code_hash;

  if v_invite_id is null then
    raise exception 'Invite code not found';
  end if;

  perform 1
  from public.couples as c
  where c.id = v_couple_id
  for update;

  select ci.expires_at, ci.used_at
  into v_expires_at, v_used_at
  from public.couple_invites as ci
  where ci.id = v_invite_id
    and ci.couple_id = v_couple_id
    and ci.code_hash = v_code_hash
  for update;

  if not found then
    raise exception 'Invite code not found';
  end if;

  if v_used_at is not null then
    raise exception 'Invite code has already been used';
  end if;

  if v_expires_at <= now() then
    raise exception 'Invite code has expired';
  end if;

  select count(*)::integer, min(cm.identity::text)::public.partner_identity
  into v_member_count, v_existing_identity
  from public.couple_members as cm
  where cm.couple_id = v_couple_id;

  if v_member_count >= 2 then
    raise exception 'Couple already has two members';
  end if;

  if v_member_count <> 1 or v_existing_identity is null then
    raise exception 'Couple does not have a valid founding member';
  end if;

  v_new_identity := case v_existing_identity
    when 'him'::public.partner_identity then 'her'::public.partner_identity
    else 'him'::public.partner_identity
  end;

  insert into public.couple_members (couple_id, user_id, identity)
  values (v_couple_id, v_user_id, v_new_identity);

  update public.couple_invites as ci
  set used_at = now(),
      used_by = v_user_id
  where ci.id = v_invite_id;

  return query
  select v_couple_id, v_new_identity;
end;
$$;

revoke all on function public.redeem_couple_invite(text) from public, anon;
grant execute on function public.redeem_couple_invite(text) to authenticated;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.couples from public, anon, authenticated;
revoke all on table public.couple_members from public, anon, authenticated;
revoke all on table public.couple_invites from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.couples to authenticated;
grant select on table public.couple_members to authenticated;

revoke all on type public.partner_identity from public, anon;
grant usage on type public.partner_identity to authenticated;
