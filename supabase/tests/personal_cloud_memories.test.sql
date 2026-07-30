begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, auth, extensions;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  reauthentication_token, phone_change, phone_change_token, raw_app_meta_data,
  raw_user_meta_data, is_super_admin, created_at, updated_at, last_sign_in_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000aa01', 'authenticated', 'authenticated', 'memory-a@example.test', crypt('password-a', gen_salt('bf')), now(), '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Memory A"}'::jsonb, false, now(), now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000bb02', 'authenticated', 'authenticated', 'memory-b@example.test', crypt('password-b', gen_salt('bf')), now(), '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Memory B"}'::jsonb, false, now(), now(), now(), false, false);

insert into public.couples (id, created_by) values ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000aa01');
insert into public.couple_members (couple_id, user_id, identity) values
  ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000aa01', 'him'),
  ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000bb02', 'her');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000aa01', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok($$select public.save_daily_note('2026-08-12', '我的', 'A 的记录')$$, 'first member saves own note');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000bb02', true);
set local role authenticated;
select lives_ok($$select public.save_daily_note('2026-08-12', '对方', 'B 的记录')$$, 'second member saves an independent same-day note');
select is((select count(*)::integer from public.daily_notes where date = '2026-08-12'), 2, 'same day retains both member notes');
select throws_ok($$delete from public.daily_notes where created_by = '00000000-0000-0000-0000-00000000aa01'::uuid$$, '42501', null, 'partner cannot delete another member note');

select has_table('public', 'daily_photos', 'private photo metadata table exists');
select has_function('public', 'create_daily_photo', 'photo metadata RPC exists');
select lives_ok($$select public.create_daily_photo('2026-08-12', '00000000-0000-0000-0000-00000000cc03/2026-08-12/photo.jpg', 'image/jpeg')$$, 'member records own private photo');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000bb02', true);
set local role authenticated;
select lives_ok($$select public.create_daily_photo('2026-08-12', '00000000-0000-0000-0000-00000000cc03/2026-08-12/partner-photo.jpg', 'image/jpeg')$$, 'second member records an independent same-day photo');
select is((select count(*)::integer from public.daily_photos where date = '2026-08-12'), 2, 'same day retains both member photos');

select * from finish();
rollback;
