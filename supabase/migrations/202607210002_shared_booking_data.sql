create type public.invitation_status as enum (
  'pending',
  'adjustment_pending',
  'confirmed',
  'rejected',
  'cancelled'
);

create type public.invitation_action as enum (
  'created',
  'confirmed',
  'rejected',
  'cancelled',
  'adjustment_suggested',
  'adjustment_accepted'
);

create type public.notification_kind as enum (
  'created',
  'adjusted',
  'confirmed',
  'rejected',
  'cancelled'
);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  date date not null,
  periods text[] not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (couple_id, owner_id, date),
  check (
    cardinality(periods) > 0
    and periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[]
  )
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  date date not null,
  periods text[] not null,
  activities text[] not null,
  note text not null default '',
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (
    cardinality(periods) > 0
    and periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[]
  ),
  check (cardinality(activities) > 0 and array_position(activities, '') is null)
);

create table public.invitation_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action public.invitation_action not null,
  note text,
  proposed_date date,
  proposed_periods text[],
  proposed_activities text[],
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  kind public.notification_kind not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  date date not null,
  title text not null default '',
  body text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, date),
  check (char_length(btrim(body)) > 0)
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  calendar_scale text not null default 'month'
    check (calendar_scale in ('month', 'year', 'five_years')),
  updated_at timestamptz not null default now()
);

create index availabilities_couple_id_idx on public.availabilities (couple_id);
create index invitations_couple_id_idx on public.invitations (couple_id);
create index invitations_couple_date_status_idx
  on public.invitations (couple_id, date, status);
create index invitation_events_couple_id_idx on public.invitation_events (couple_id);
create index invitation_events_invitation_created_idx
  on public.invitation_events (invitation_id, created_at);
create index notifications_couple_id_idx on public.notifications (couple_id);
create index notifications_recipient_read_idx
  on public.notifications (recipient_id, read_at);
create index daily_notes_couple_id_idx on public.daily_notes (couple_id);

alter table public.availabilities enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_events enable row level security;
alter table public.notifications enable row level security;
alter table public.daily_notes enable row level security;
alter table public.user_preferences enable row level security;

create policy availabilities_select_couple
  on public.availabilities for select to authenticated
  using (public.is_couple_member(couple_id));

create policy availabilities_insert_owner
  on public.availabilities for insert to authenticated
  with check (owner_id = auth.uid() and couple_id = public.current_couple_id());

create policy availabilities_update_owner
  on public.availabilities for update to authenticated
  using (owner_id = auth.uid() and couple_id = public.current_couple_id())
  with check (owner_id = auth.uid() and couple_id = public.current_couple_id());

create policy invitations_select_couple
  on public.invitations for select to authenticated
  using (public.is_couple_member(couple_id));

create policy invitation_events_select_couple
  on public.invitation_events for select to authenticated
  using (public.is_couple_member(couple_id));

create policy notifications_select_couple
  on public.notifications for select to authenticated
  using (public.is_couple_member(couple_id));

create policy daily_notes_select_couple
  on public.daily_notes for select to authenticated
  using (public.is_couple_member(couple_id));

create policy user_preferences_select_own
  on public.user_preferences for select to authenticated
  using (user_id = auth.uid());

create policy user_preferences_insert_own
  on public.user_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy user_preferences_update_own
  on public.user_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.availabilities from public, anon, authenticated;
revoke all on table public.invitations from public, anon, authenticated;
revoke all on table public.invitation_events from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.daily_notes from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;

grant select, insert, update on table public.availabilities to authenticated;
grant select on table public.invitations to authenticated;
grant select on table public.invitation_events to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.daily_notes to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;

grant usage on type public.invitation_status to authenticated;
grant usage on type public.invitation_action to authenticated;
grant usage on type public.notification_kind to authenticated;

create or replace function public.save_availability(
  p_date date,
  p_periods text[],
  p_note text
)
returns public.availabilities
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_availability public.availabilities;
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;

  if p_date is null
    or cardinality(p_periods) = 0
    or not (p_periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[])
  then
    raise exception 'Invalid availability';
  end if;

  insert into public.availabilities as a (couple_id, owner_id, date, periods, note)
  values (v_couple_id, v_user_id, p_date, p_periods, coalesce(p_note, ''))
  on conflict (couple_id, owner_id, date) do update
  set periods = excluded.periods,
      note = excluded.note,
      updated_at = now()
  returning a.* into v_availability;

  return v_availability;
end;
$$;

create or replace function public.create_invitation(
  p_date date,
  p_periods text[],
  p_activities text[],
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_recipient_id uuid;
  v_invitation_id uuid;
  v_activities text[];
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;

  if p_date is null
    or cardinality(p_periods) = 0
    or not (p_periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[])
  then
    raise exception 'Invalid invitation';
  end if;

  select array_agg(activity order by activity)
  into v_activities
  from (
    select distinct btrim(activity) as activity
    from unnest(coalesce(p_activities, '{}'::text[])) as activity
    where btrim(activity) <> ''
  ) as normalized;

  if cardinality(v_activities) = 0 then
    raise exception 'Invalid invitation';
  end if;

  perform 1
  from public.couples as c
  where c.id = v_couple_id
  for update;

  select cm.user_id
  into v_recipient_id
  from public.couple_members as cm
  where cm.couple_id = v_couple_id
    and cm.user_id <> v_user_id;

  if v_recipient_id is null then
    raise exception 'Partner is required';
  end if;

  insert into public.invitations (
    couple_id, sender_id, recipient_id, date, periods, activities, note
  )
  values (
    v_couple_id, v_user_id, v_recipient_id, p_date, p_periods, v_activities, coalesce(p_note, '')
  )
  returning id into v_invitation_id;

  insert into public.invitation_events (
    couple_id, invitation_id, actor_id, action
  )
  values (v_couple_id, v_invitation_id, v_user_id, 'created');

  insert into public.notifications (
    couple_id, recipient_id, invitation_id, kind
  )
  values (v_couple_id, v_recipient_id, v_invitation_id, 'created');

  return v_invitation_id;
end;
$$;

create or replace function public.respond_to_invitation(
  p_invitation_id uuid,
  p_action text,
  p_note text default null,
  p_date date default null,
  p_periods text[] default null,
  p_activities text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_invitation public.invitations;
  v_notification_recipient uuid;
  v_event_action public.invitation_action;
  v_notification_kind public.notification_kind;
  v_activities text[];
  v_adjustment public.invitation_events;
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;

  select i.*
  into v_invitation
  from public.invitations as i
  where i.id = p_invitation_id
    and i.couple_id = v_couple_id
  for update;

  if not found then
    raise exception 'not allowed';
  end if;

  if p_action = 'confirm' then
    if v_invitation.status <> 'pending' or v_user_id <> v_invitation.recipient_id then
      raise exception 'not allowed';
    end if;
    update public.invitations
    set status = 'confirmed', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'confirmed';
    v_notification_kind := 'confirmed';
    v_notification_recipient := v_invitation.sender_id;
  elsif p_action = 'reject' then
    if v_invitation.status <> 'pending' or v_user_id <> v_invitation.recipient_id then
      raise exception 'not allowed';
    end if;
    update public.invitations
    set status = 'rejected', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'rejected';
    v_notification_kind := 'rejected';
    v_notification_recipient := v_invitation.sender_id;
  elsif p_action = 'cancel' then
    if v_invitation.status not in ('pending', 'adjustment_pending')
      or v_user_id <> v_invitation.sender_id
    then
      raise exception 'not allowed';
    end if;
    update public.invitations
    set status = 'cancelled', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'cancelled';
    v_notification_kind := 'cancelled';
    v_notification_recipient := v_invitation.recipient_id;
  elsif p_action = 'suggest-adjustment' then
    if v_invitation.status <> 'pending' or v_user_id <> v_invitation.recipient_id then
      raise exception 'not allowed';
    end if;
    if p_date is null
      or cardinality(p_periods) = 0
      or not (p_periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[])
    then
      raise exception 'Invalid adjustment';
    end if;
    select array_agg(activity order by activity)
    into v_activities
    from (
      select distinct btrim(activity) as activity
      from unnest(coalesce(p_activities, '{}'::text[])) as activity
      where btrim(activity) <> ''
    ) as normalized;
    if cardinality(v_activities) = 0 then
      raise exception 'Invalid adjustment';
    end if;
    update public.invitations
    set status = 'adjustment_pending', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'adjustment_suggested';
    v_notification_kind := 'adjusted';
    v_notification_recipient := v_invitation.sender_id;
  elsif p_action = 'accept-adjustment' then
    if v_invitation.status <> 'adjustment_pending'
      or v_user_id <> v_invitation.sender_id
    then
      raise exception 'not allowed';
    end if;
    select e.*
    into v_adjustment
    from public.invitation_events as e
    where e.invitation_id = v_invitation.id
      and e.action = 'adjustment_suggested'
    order by e.created_at desc, e.id desc
    limit 1;
    if v_adjustment.proposed_date is null
      or cardinality(v_adjustment.proposed_periods) = 0
      or cardinality(v_adjustment.proposed_activities) = 0
    then
      raise exception 'not allowed';
    end if;
    update public.invitations
    set date = v_adjustment.proposed_date,
        periods = v_adjustment.proposed_periods,
        activities = v_adjustment.proposed_activities,
        status = 'confirmed',
        updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'adjustment_accepted';
    v_notification_kind := 'confirmed';
    v_notification_recipient := v_invitation.recipient_id;
  else
    raise exception 'not allowed';
  end if;

  insert into public.invitation_events (
    couple_id,
    invitation_id,
    actor_id,
    action,
    note,
    proposed_date,
    proposed_periods,
    proposed_activities
  )
  values (
    v_couple_id,
    v_invitation.id,
    v_user_id,
    v_event_action,
    p_note,
    case when p_action = 'suggest-adjustment' then p_date end,
    case when p_action = 'suggest-adjustment' then p_periods end,
    case when p_action = 'suggest-adjustment' then v_activities end
  );

  insert into public.notifications (
    couple_id, recipient_id, invitation_id, kind
  )
  values (
    v_couple_id, v_notification_recipient, v_invitation.id, v_notification_kind
  );
end;
$$;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and couple_id = v_couple_id
    and recipient_id = v_user_id;

  if not found then
    raise exception 'not allowed';
  end if;
end;
$$;

create or replace function public.save_daily_note(
  p_date date,
  p_title text,
  p_body text
)
returns public.daily_notes
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_note public.daily_notes;
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;
  if p_date is null or char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Invalid daily note';
  end if;

  insert into public.daily_notes as n (couple_id, date, title, body, created_by)
  values (v_couple_id, p_date, btrim(coalesce(p_title, '')), p_body, v_user_id)
  on conflict (couple_id, date) do update
  set title = excluded.title,
      body = excluded.body,
      updated_at = now()
  returning n.* into v_note;

  return v_note;
end;
$$;

create or replace function public.delete_daily_note(
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid := public.current_couple_id();
begin
  if auth.uid() is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.daily_notes
  where couple_id = v_couple_id and date = p_date;
end;
$$;

create or replace function public.save_user_preference(
  p_calendar_scale text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_calendar_scale not in ('month', 'year', 'five_years') then
    raise exception 'Invalid calendar scale';
  end if;

  insert into public.user_preferences as p (user_id, calendar_scale)
  values (v_user_id, p_calendar_scale)
  on conflict (user_id) do update
  set calendar_scale = excluded.calendar_scale,
      updated_at = now();
end;
$$;

revoke all on function public.save_availability(date, text[], text) from public, anon;
revoke all on function public.create_invitation(date, text[], text[], text) from public, anon;
revoke all on function public.respond_to_invitation(uuid, text, text, date, text[], text[]) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.save_daily_note(date, text, text) from public, anon;
revoke all on function public.delete_daily_note(date) from public, anon;
revoke all on function public.save_user_preference(text) from public, anon;

grant execute on function public.save_availability(date, text[], text) to authenticated;
grant execute on function public.create_invitation(date, text[], text[], text) to authenticated;
grant execute on function public.respond_to_invitation(uuid, text, text, date, text[], text[]) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.save_daily_note(date, text, text) to authenticated;
grant execute on function public.delete_daily_note(date) to authenticated;
grant execute on function public.save_user_preference(text) to authenticated;

alter publication supabase_realtime add table
  public.availabilities,
  public.invitations,
  public.invitation_events,
  public.notifications,
  public.daily_notes,
  public.user_preferences;
