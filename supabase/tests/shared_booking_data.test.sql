begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, auth, extensions;

select plan(39);

select has_type('public', 'invitation_status', 'invitation status enum exists');
select has_type('public', 'invitation_action', 'invitation action enum exists');
select has_type('public', 'notification_kind', 'notification kind enum exists');

select has_table('public', 'availabilities', 'availability table exists');
select has_table('public', 'invitations', 'invitation table exists');
select has_table('public', 'invitation_events', 'invitation event table exists');
select has_table('public', 'notifications', 'notification table exists');
select has_table('public', 'daily_notes', 'daily note table exists');
select has_table('public', 'user_preferences', 'user preference table exists');

select has_function('public', 'save_availability', 'save availability RPC exists');
select has_function('public', 'create_invitation', 'create invitation RPC exists');
select has_function('public', 'respond_to_invitation', 'respond to invitation RPC exists');
select has_function('public', 'mark_notification_read', 'mark notification read RPC exists');
select has_function('public', 'save_daily_note', 'save daily note RPC exists');
select has_function('public', 'delete_daily_note', 'delete daily note RPC exists');
select has_function('public', 'save_user_preference', 'save user preference RPC exists');

create temporary table shared_test_state (
  key text primary key,
  invitation_id uuid,
  notification_id uuid
) on commit drop;

grant all on table shared_test_state to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, reauthentication_token,
  phone_change, phone_change_token, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, last_sign_in_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000a11',
    'authenticated', 'authenticated', 'shared-a@example.test',
    crypt('password-a', gen_salt('bf')), now(), '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Shared A"}'::jsonb,
    false, now(), now(), now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000b22',
    'authenticated', 'authenticated', 'shared-b@example.test',
    crypt('password-b', gen_salt('bf')), now(), '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Shared B"}'::jsonb,
    false, now(), now(), now(), false, false
  );

insert into public.couples (id, created_by)
values ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-000000000a11');

insert into public.couple_members (couple_id, user_id, identity)
values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-000000000a11', 'him'),
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-000000000b22', 'her');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a11', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.save_availability('2026-08-10', array['morning', 'evening'], '下班后')$$,
  'member saves own availability'
);

select is(
  (select owner_id from public.availabilities where date = '2026-08-10'),
  '00000000-0000-0000-0000-000000000a11'::uuid,
  'availability owner is derived from the authenticated user'
);

select is(
  (select array_to_string(periods, ',') from public.availabilities where date = '2026-08-10'),
  'morning,evening',
  'availability stores selected periods'
);

insert into shared_test_state (key, invitation_id)
select 'pending', public.create_invitation(
  '2026-08-10', array['evening'], array['散步', '晚餐'], '一起吃饭吗'
);

select ok(
  (select invitation_id is not null from shared_test_state where key = 'pending'),
  'member creates an invitation for the paired partner'
);

select is(
  (
    select sender_id = '00000000-0000-0000-0000-000000000a11'::uuid
      and recipient_id = '00000000-0000-0000-0000-000000000b22'::uuid
      and status = 'pending'::public.invitation_status
    from public.invitations
    where id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  true,
  'invitation sender recipient and pending state are server-derived'
);

select is(
  (
    select count(*)::integer
    from public.invitation_events
    where invitation_id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  1,
  'creating an invitation creates one immutable event'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where invitation_id = (select invitation_id from shared_test_state where key = 'pending')
      and recipient_id = '00000000-0000-0000-0000-000000000b22'::uuid
  ),
  1,
  'creating an invitation creates one notification for the recipient'
);

select throws_ok(
  format(
    'select public.respond_to_invitation(%L::uuid, ''confirm'', null, null, null, null)',
    (select invitation_id from shared_test_state where key = 'pending')
  ),
  'P0001',
  'not allowed',
  'sender cannot confirm own pending invitation'
);

select is(
  (
    select status::text from public.invitations
    where id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  'pending',
  'rejected transition leaves invitation unchanged'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000b22', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  format(
    'select public.respond_to_invitation(%L::uuid, ''suggest-adjustment'', ''周末更好'', ''2026-08-11'', array[''afternoon''], array[''咖啡''])',
    (select invitation_id from shared_test_state where key = 'pending')
  ),
  'recipient suggests an adjustment'
);

select is(
  (
    select status::text from public.invitations
    where id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  'adjustment_pending',
  'suggestion moves invitation into adjustment pending state'
);

insert into shared_test_state (key, notification_id)
select 'b_created_notification', n.id
from public.notifications as n
where n.invitation_id = (select invitation_id from shared_test_state where key = 'pending')
  and n.recipient_id = '00000000-0000-0000-0000-000000000b22'
limit 1;

select lives_ok(
  format(
    'select public.mark_notification_read(%L::uuid)',
    (select notification_id from shared_test_state where key = 'b_created_notification')
  ),
  'recipient marks own notification as read'
);

select ok(
  (
    select read_at is not null
    from public.notifications
    where id = (select notification_id from shared_test_state where key = 'b_created_notification')
  ),
  'marking a notification records read time'
);

select lives_ok(
  $$select public.save_daily_note('2026-08-10', '今天', '一起期待周末')$$,
  'member saves a daily note'
);

select is(
  (select body from public.daily_notes where date = '2026-08-10'),
  '一起期待周末',
  'daily note body is stored in the couple space'
);

select lives_ok(
  $$select public.save_user_preference('year')$$,
  'member saves own calendar preference'
);

select is(
  (
    select calendar_scale
    from public.user_preferences
    where user_id = '00000000-0000-0000-0000-000000000b22'::uuid
  ),
  'year',
  'calendar preference belongs to the authenticated user'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a11', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  format(
    'select public.respond_to_invitation(%L::uuid, ''accept-adjustment'', null, null, null, null)',
    (select invitation_id from shared_test_state where key = 'pending')
  ),
  'sender accepts the proposed adjustment'
);

select is(
  (
    select date::text || ':' || status::text
    from public.invitations
    where id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  '2026-08-11:confirmed',
  'accepting adjustment applies proposed date and confirms invitation'
);

select is(
  (
    select count(*)::integer
    from public.invitation_events
    where invitation_id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  3,
  'each successful invitation transition appends exactly one event'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000b22', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  format(
    'select public.respond_to_invitation(%L::uuid, ''cancel'', null, null, null, null)',
    (select invitation_id from shared_test_state where key = 'pending')
  ),
  'recipient can cancel a confirmed invitation'
);

select is(
  (
    select status::text
    from public.invitations
    where id = (select invitation_id from shared_test_state where key = 'pending')
  ),
  'cancelled',
  'cancelling a confirmed invitation updates its status'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where invitation_id = (select invitation_id from shared_test_state where key = 'pending')
      and recipient_id = '00000000-0000-0000-0000-000000000a11'::uuid
      and kind = 'cancelled'::public.notification_kind
  ),
  1,
  'cancelling a confirmed invitation notifies the other partner'
);

select * from finish();
rollback;
