alter table public.daily_notes
  drop constraint daily_notes_couple_id_date_key;

alter table public.daily_notes
  add constraint daily_notes_couple_date_creator_key unique (couple_id, date, created_by);

create table public.daily_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  date date not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  check (storage_path like couple_id::text || '/' || date::text || '/%')
);

create index daily_photos_couple_date_uploader_idx
  on public.daily_photos (couple_id, date, uploaded_by, created_at);

alter table public.daily_photos enable row level security;

create policy daily_photos_select_couple
  on public.daily_photos for select to authenticated
  using (public.is_couple_member(couple_id));

revoke all on table public.daily_photos from public, anon, authenticated;
grant select on table public.daily_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('date-photos', 'date-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy date_photos_read_couple
  on storage.objects for select to authenticated
  using (
    bucket_id = 'date-photos'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );

create policy date_photos_insert_member
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'date-photos'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );

create policy date_photos_delete_owner
  on storage.objects for delete to authenticated
  using (bucket_id = 'date-photos' and owner_id = auth.uid()::text);

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
  on conflict (couple_id, date, created_by) do update
  set title = excluded.title,
      body = excluded.body,
      updated_at = now()
  returning n.* into v_note;

  return v_note;
end;
$$;

create or replace function public.delete_daily_note(p_date date)
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
  where couple_id = v_couple_id
    and date = p_date
    and created_by = auth.uid();
end;
$$;

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
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
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

revoke all on function public.create_daily_photo(date, text, text) from public, anon;
grant execute on function public.create_daily_photo(date, text, text) to authenticated;

create or replace function public.delete_daily_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid := public.current_couple_id();
  v_path text;
begin
  if auth.uid() is null or v_couple_id is null then raise exception 'Authentication required'; end if;
  delete from public.daily_photos
  where id = p_photo_id and couple_id = v_couple_id and uploaded_by = auth.uid()
  returning storage_path into v_path;
  if v_path is null then raise exception 'Photo not found'; end if;
  return v_path;
end;
$$;

revoke all on function public.delete_daily_photo(uuid) from public, anon;
grant execute on function public.delete_daily_photo(uuid) to authenticated;

alter publication supabase_realtime add table public.daily_photos;
