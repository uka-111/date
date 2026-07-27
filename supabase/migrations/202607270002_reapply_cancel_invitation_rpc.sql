-- Reapply the cancellation-aware invitation RPC for projects where the
-- migration catalog advanced but the function body remained stale.
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
    update public.invitations set status = 'confirmed', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'confirmed';
    v_notification_kind := 'confirmed';
    v_notification_recipient := v_invitation.sender_id;
  elsif p_action = 'reject' then
    if v_invitation.status <> 'pending' or v_user_id <> v_invitation.recipient_id then
      raise exception 'not allowed';
    end if;
    update public.invitations set status = 'rejected', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'rejected';
    v_notification_kind := 'rejected';
    v_notification_recipient := v_invitation.sender_id;
  elsif p_action = 'cancel' then
    if v_invitation.status not in ('pending', 'adjustment_pending', 'confirmed')
      or v_user_id not in (v_invitation.sender_id, v_invitation.recipient_id)
    then
      raise exception 'not allowed';
    end if;
    update public.invitations set status = 'cancelled', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'cancelled';
    v_notification_kind := 'cancelled';
    v_notification_recipient := case
      when v_user_id = v_invitation.sender_id then v_invitation.recipient_id
      else v_invitation.sender_id
    end;
  elsif p_action = 'suggest-adjustment' then
    if v_invitation.status <> 'pending' or v_user_id <> v_invitation.recipient_id then
      raise exception 'not allowed';
    end if;
    if p_date is null or cardinality(p_periods) = 0
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
    update public.invitations set status = 'adjustment_pending', updated_at = now()
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
    select e.* into v_adjustment
    from public.invitation_events as e
    where e.invitation_id = v_invitation.id
      and e.action = 'adjustment_suggested'
    order by e.created_at desc, e.id desc limit 1;
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
        status = 'confirmed', updated_at = now()
    where id = v_invitation.id;
    v_event_action := 'adjustment_accepted';
    v_notification_kind := 'confirmed';
    v_notification_recipient := v_invitation.recipient_id;
  else
    raise exception 'not allowed';
  end if;

  insert into public.invitation_events (
    couple_id, invitation_id, actor_id, action, note,
    proposed_date, proposed_periods, proposed_activities
  )
  values (
    v_couple_id, v_invitation.id, v_user_id, v_event_action, p_note,
    case when p_action = 'suggest-adjustment' then p_date end,
    case when p_action = 'suggest-adjustment' then p_periods end,
    case when p_action = 'suggest-adjustment' then v_activities end
  );

  insert into public.notifications (couple_id, recipient_id, invitation_id, kind)
  values (v_couple_id, v_notification_recipient, v_invitation.id, v_notification_kind);
end;
$$;

revoke all on function public.respond_to_invitation(uuid, text, text, date, text[], text[]) from public, anon;
grant execute on function public.respond_to_invitation(uuid, text, text, date, text[], text[]) to authenticated;

notify pgrst, 'reload schema';
