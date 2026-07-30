alter table public.daily_photos
  drop constraint if exists daily_photos_mime_type_check;

alter table public.daily_photos
  add constraint daily_photos_mime_type_check
  check (mime_type in ('image/gif', 'image/jpeg', 'image/png', 'image/webp'));

update storage.buckets
set allowed_mime_types = array['image/gif', 'image/jpeg', 'image/png', 'image/webp']
where id = 'date-photos';

create or replace function public.create_daily_photo(
  p_date date,
  p_storage_path text,
  p_mime_type text
)
returns public.daily_photos
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_photo public.daily_photos;
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'Authentication required';
  end if;
  if p_date is null
    or p_mime_type not in ('image/gif', 'image/jpeg', 'image/png', 'image/webp')
    or p_storage_path not like v_couple_id::text || '/' || p_date::text || '/%'
  then
    raise exception 'Invalid photo';
  end if;
  if (select count(*) from public.daily_photos where couple_id = v_couple_id and date = p_date and uploaded_by = v_user_id) >= 30 then
    raise exception '每天最多保存 30 张照片';
  end if;

  insert into public.daily_photos (couple_id, date, uploaded_by, storage_path, mime_type)
  values (v_couple_id, p_date, v_user_id, p_storage_path, p_mime_type)
  returning * into v_photo;
  return v_photo;
end;
$$;
