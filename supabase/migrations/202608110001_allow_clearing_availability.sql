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
    or p_periods is null
    or not (p_periods <@ array['all_day', 'morning', 'afternoon', 'evening']::text[])
  then
    raise exception 'Invalid availability';
  end if;

  if cardinality(p_periods) = 0 then
    delete from public.availabilities
    where couple_id = v_couple_id
      and owner_id = v_user_id
      and date = p_date;
    return null;
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
