begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, auth, extensions;

select plan(50);

create function pg_temp.normalized_function_definition(p_function regprocedure)
returns text
language sql
stable
as $$
  select lower(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            pg_get_functiondef(p_function),
            '/\*([^*]|\*+[^*/])*\*+/',
            ' ',
            'g'
          ),
          '--.*$',
          ' ',
          'gn'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$$;

create function pg_temp.commented_lock_sample()
returns void
language plpgsql
as $$
begin
  perform 1; -- perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  /*
    select 1
    from public.couples
    for update;
  */
end;
$$;

do $$
declare
  v_definition text := pg_temp.normalized_function_definition(
    'pg_temp.commented_lock_sample()'::regprocedure
  );
begin
  if v_definition ~ 'pg_advisory_xact_lock|for[[:space:]]+update' then
    raise exception 'normalized function definition retained commented lock text: %', v_definition;
  end if;
end;
$$;

create temporary table pairing_test_state (
  key text primary key,
  couple_id uuid,
  invite_code text,
  expires_at timestamptz,
  identity public.partner_identity
) on commit drop;

grant all on table pairing_test_state to authenticated;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  reauthentication_token,
  phone_change,
  phone_change_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  last_sign_in_at,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated',
    'authenticated',
    'a@example.test',
    crypt('password-a', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Partner A"}'::jsonb,
    false,
    now(),
    now(),
    now(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000b2',
    'authenticated',
    'authenticated',
    'b@example.test',
    crypt('password-b', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Partner B"}'::jsonb,
    false,
    now(),
    now(),
    now(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000c3',
    'authenticated',
    'authenticated',
    'c@example.test',
    crypt('password-c', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Partner C"}'::jsonb,
    false,
    now(),
    now(),
    now(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000d4',
    'authenticated',
    'authenticated',
    'd@example.test',
    crypt('password-d', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Partner D"}'::jsonb,
    false,
    now(),
    now(),
    now(),
    false,
    false
  );

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-0000000000c3',
      '00000000-0000-0000-0000-0000000000d4'
    )
  ),
  4,
  'auth.users inserts execute the profile trigger for all test accounts'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into pairing_test_state (key, couple_id, invite_code, expires_at)
select 'a_initial', couple_id, invite_code, expires_at
from public.create_couple_with_invite('him');

select ok(
  (
    select char_length(invite_code) = 12
      and invite_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$'
    from pairing_test_state
    where key = 'a_initial'
  ),
  'A receives a 12-character uppercase unambiguous invite code'
);

select ok(
  (
    select expires_at between now() + interval '6 days 23 hours'
      and now() + interval '7 days 1 hour'
    from pairing_test_state
    where key = 'a_initial'
  ),
  'A invite expires in seven days'
);

select ok(
  (select couple_id is not null from pairing_test_state where key = 'a_initial'),
  'A receives the created couple id'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.couple_members
    where couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  1,
  'A is the first member of the new couple'
);

select is(
  (
    select identity::text
    from public.couple_members
    where user_id = '00000000-0000-0000-0000-0000000000a1'
  ),
  'him',
  'A keeps the selected identity'
);

select ok(
  (
    select char_length(code_hash) = 64
      and code_hash = (
        select encode(digest(invite_code, 'sha256'), 'hex')
        from pairing_test_state
        where key = 'a_initial'
      )
    from public.couple_invites
    where couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  'the database stores the matching 64-character SHA256 invite hash'
);

select is(
  (
    select count(*)::integer
    from public.couple_invites
    where code_hash = (select invite_code from pairing_test_state where key = 'a_initial')
  ),
  0,
  'the plaintext invite code is never stored'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select throws_ok(
  $$select * from public.create_couple_with_invite('her')$$,
  'P0001',
  'User already belongs to a couple',
  'A cannot create a second couple'
);

insert into pairing_test_state (key, invite_code, expires_at)
select 'a_regenerated_once', invite_code, expires_at
from public.regenerate_couple_invite();

reset role;

select ok(
  (
    select revoked_at is not null
    from public.couple_invites
    where code_hash = (
      select encode(digest(invite_code, 'sha256'), 'hex')
      from pairing_test_state
      where key = 'a_initial'
    )
  ),
  'regenerate revokes the previous invite'
);

select isnt(
  (select invite_code from pairing_test_state where key = 'a_regenerated_once'),
  (select invite_code from pairing_test_state where key = 'a_initial'),
  'regenerate returns a different invite code'
);

select ok(
  (
    select expires_at between now() + interval '6 days 23 hours'
      and now() + interval '7 days 1 hour'
    from pairing_test_state
    where key = 'a_regenerated_once'
  ),
  'regenerated invite expires in seven days'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
set local role authenticated;

select throws_ok(
  format(
    'select * from public.redeem_couple_invite(%L)',
    (select invite_code from pairing_test_state where key = 'a_initial')
  ),
  'P0001',
  'Invite code unavailable',
  'B cannot redeem a revoked invite and receives the unified error'
);

reset role;

update public.couple_invites
set expires_at = now() - interval '1 minute'
where code_hash = (
  select encode(digest(invite_code, 'sha256'), 'hex')
  from pairing_test_state
  where key = 'a_regenerated_once'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
set local role authenticated;

select throws_ok(
  format(
    'select * from public.redeem_couple_invite(%L)',
    (select invite_code from pairing_test_state where key = 'a_regenerated_once')
  ),
  'P0001',
  'Invite code unavailable',
  'B cannot redeem an expired invite and receives the unified error'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

insert into pairing_test_state (key, invite_code, expires_at)
select 'a_regenerated_twice', invite_code, expires_at
from public.regenerate_couple_invite();

reset role;

select ok(
  (
    select revoked_at is not null
    from public.couple_invites
    where code_hash = (
      select encode(digest(invite_code, 'sha256'), 'hex')
      from pairing_test_state
      where key = 'a_regenerated_once'
    )
  ),
  'regenerate also revokes an expired active invite'
);

select isnt(
  (select invite_code from pairing_test_state where key = 'a_regenerated_twice'),
  (select invite_code from pairing_test_state where key = 'a_regenerated_once'),
  'a second regenerate returns another different code'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
set local role authenticated;

insert into pairing_test_state (key, couple_id, identity)
select 'b_redeem', couple_id, identity
from public.redeem_couple_invite(
  (select invite_code from pairing_test_state where key = 'a_regenerated_twice')
);

select ok(
  (
    select couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
      and identity = 'her'::public.partner_identity
    from pairing_test_state
    where key = 'b_redeem'
  ),
  'B redeems the new code into A couple with the opposite identity'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.couple_members
    where couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  2,
  'A couple contains exactly two members after redemption'
);

select is(
  (
    select identity::text
    from public.couple_members
    where user_id = '00000000-0000-0000-0000-0000000000b2'
  ),
  'her',
  'B membership stores the opposite identity'
);

select ok(
  (
    select used_at is not null
    from public.couple_invites
    where code_hash = (
      select encode(digest(invite_code, 'sha256'), 'hex')
      from pairing_test_state
      where key = 'a_regenerated_twice'
    )
  ),
  'redeeming marks the invite used'
);

select is(
  (
    select used_by
    from public.couple_invites
    where code_hash = (
      select encode(digest(invite_code, 'sha256'), 'hex')
      from pairing_test_state
      where key = 'a_regenerated_twice'
    )
  ),
  '00000000-0000-0000-0000-0000000000b2'::uuid,
  'redeeming records B as used_by'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
set local role authenticated;

select throws_ok(
  format(
    'select * from public.redeem_couple_invite(%L)',
    (select invite_code from pairing_test_state where key = 'a_regenerated_twice')
  ),
  'P0001',
  'Invite code unavailable',
  'B cannot redeem the same plaintext twice and receives the unified error'
);

reset role;

insert into public.couple_invites (
  couple_id,
  code_hash,
  created_by,
  expires_at
)
values (
  (select couple_id from pairing_test_state where key = 'a_initial'),
  encode(digest('FULLCUPLE234', 'sha256'), 'hex'),
  '00000000-0000-0000-0000-0000000000a1',
  now() + interval '7 days'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
set local role authenticated;

select throws_ok(
  $$select * from public.redeem_couple_invite('FULLCUPLE234')$$,
  'P0001',
  'Invite code unavailable',
  'C cannot join a full couple with an otherwise available invite'
);

reset role;

select ok(
  (
    select
      (
        select count(*) = 2
        from public.couple_members
        where couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
      )
      and used_at is null
      and used_by is null
    from public.couple_invites
    where code_hash = encode(digest('FULLCUPLE234', 'sha256'), 'hex')
  ),
  'a failed third-member redemption leaves two members and the invite unused'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
set local role authenticated;

select throws_ok(
  $$select * from public.redeem_couple_invite('short')$$,
  'P0001',
  'Invite code unavailable',
  'a malformed invite receives the unified unavailable error'
);

select throws_ok(
  $$select * from public.redeem_couple_invite('ZZZZZZZZZZZZ')$$,
  'P0001',
  'Invite code unavailable',
  'an unknown invite receives the unified unavailable error'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select throws_ok(
  $$select * from public.regenerate_couple_invite()$$,
  'P0001',
  'Couple already has two members',
  'a full couple cannot regenerate an invite'
);

select throws_ok(
  $$select count(*) from public.couple_invites$$,
  '42501',
  'permission denied for table couple_invites',
  'a couple member cannot select invite rows'
);

select is(
  (
    select count(*)::integer
    from public.couples
    where id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  1,
  'A can read A own couple through RLS'
);

select is(
  (
    select count(*)::integer
    from public.couple_members
    where couple_id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  2,
  'A can read both memberships in A own couple through RLS'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501',
  'permission denied for table profiles',
  'anonymous users cannot read profiles'
);

select throws_ok(
  $$select count(*) from public.couples$$,
  '42501',
  'permission denied for table couples',
  'anonymous users cannot read couples'
);

select throws_ok(
  $$select count(*) from public.couple_members$$,
  '42501',
  'permission denied for table couple_members',
  'anonymous users cannot read memberships'
);

select throws_ok(
  $$select count(*) from public.couple_invites$$,
  '42501',
  'permission denied for table couple_invites',
  'anonymous users cannot read invites'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
set local role authenticated;

insert into pairing_test_state (key, couple_id, invite_code, expires_at)
select 'c_initial', couple_id, invite_code, expires_at
from public.create_couple_with_invite('her');

select is(
  (select char_length(invite_code) from pairing_test_state where key = 'c_initial'),
  12,
  'C creates a separate couple with a valid invite'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d4', true);
set local role authenticated;

insert into pairing_test_state (key, couple_id, identity)
select 'd_redeem', couple_id, identity
from public.redeem_couple_invite(
  (select invite_code from pairing_test_state where key = 'c_initial')
);

select is(
  (select identity::text from pairing_test_state where key = 'd_redeem'),
  'him',
  'D receives the opposite identity in C separate couple'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.couples
    where id = (select couple_id from pairing_test_state where key = 'c_initial')
  ),
  0,
  'A cannot read another couple'
);

select is(
  (
    select count(*)::integer
    from public.couple_members
    where couple_id = (select couple_id from pairing_test_state where key = 'c_initial')
  ),
  0,
  'A cannot read another couple memberships'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c3'
  ),
  0,
  'A cannot read a profile from another couple'
);

reset role;

delete from auth.users
where id = '00000000-0000-0000-0000-0000000000a1';

select is(
  (
    select count(*)::integer
    from public.couples
    where id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  1,
  'deleting one member account preserves the couple'
);

select is(
  (
    select count(*)::integer
    from public.couple_members
    where user_id = '00000000-0000-0000-0000-0000000000b2'
  ),
  1,
  'deleting one member account preserves the other membership'
);

delete from auth.users
where id = '00000000-0000-0000-0000-0000000000b2';

select is(
  (
    select count(*)::integer
    from public.couples
    where id = (select couple_id from pairing_test_state where key = 'a_initial')
  ),
  0,
  'deleting the last member account triggers empty-couple cleanup'
);

-- pgTAP runs this file in one connection, so it cannot create a reliable
-- simultaneous redeem race. These assertions prove the uniqueness constraints
-- and the exact transaction-lock statements used by the pairing functions.
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'couple_members'
      and indexname = 'couple_members_one_active_per_user_idx'
  ),
  'concurrent redemption is guarded by one active membership per user'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.couple_members'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (couple_id, identity)'
  ),
  'concurrent redemption is guarded by unique identity per couple'
);

select ok(
  pg_temp.normalized_function_definition(
    'public.create_couple_with_invite(public.partner_identity)'::regprocedure
  ) ~
    'perform[[:space:]]+pg_advisory_xact_lock[[:space:]]*\([[:space:]]*hashtextextended[[:space:]]*\([[:space:]]*v_user_id::text[[:space:]]*,[[:space:]]*0[[:space:]]*\)[[:space:]]*\)',
  'create serializes the authenticated user with the expected advisory transaction lock key'
);

select ok(
  pg_temp.normalized_function_definition(
    'public.regenerate_couple_invite()'::regprocedure
  ) ~
    'perform[[:space:]]+1[[:space:]]+from[[:space:]]+public\.couples[[:space:]]+as[[:space:]]+c[[:space:]]+where[[:space:]]+c\.id[[:space:]]*=[[:space:]]*v_couple_id[[:space:]]+for[[:space:]]+update',
  'regenerate locks the selected public.couples row before counting members'
);

select ok(
  pg_temp.normalized_function_definition(
    'public.regenerate_couple_invite()'::regprocedure
  ) ~
    'where[[:space:]]+cm\.user_id[[:space:]]*=[[:space:]]*v_user_id[[:space:]]+and[[:space:]]+cm\.left_at[[:space:]]+is[[:space:]]+null'
    and pg_temp.normalized_function_definition(
      'public.regenerate_couple_invite()'::regprocedure
    ) ~
    'where[[:space:]]+cm\.couple_id[[:space:]]*=[[:space:]]*v_couple_id[[:space:]]+and[[:space:]]+cm\.left_at[[:space:]]+is[[:space:]]+null',
  'regenerate only uses the current membership and active members after unpairing recovery'
);

select ok(
  pg_temp.normalized_function_definition(
    'public.redeem_couple_invite(text)'::regprocedure
  ) ~
    'perform[[:space:]]+1[[:space:]]+from[[:space:]]+public\.couples[[:space:]]+as[[:space:]]+c[[:space:]]+where[[:space:]]+c\.id[[:space:]]*=[[:space:]]*v_couple_id[[:space:]]+for[[:space:]]+update',
  'redeem locks the selected public.couples row before validating capacity'
);

select ok(
  pg_temp.normalized_function_definition(
    'public.redeem_couple_invite(text)'::regprocedure
  ) ~
    'select[[:space:]]+ci\.expires_at[[:space:]]*,[[:space:]]*ci\.used_at[[:space:]]*,[[:space:]]*ci\.revoked_at[[:space:]]+into[[:space:]]+v_expires_at[[:space:]]*,[[:space:]]*v_used_at[[:space:]]*,[[:space:]]*v_revoked_at[[:space:]]+from[[:space:]]+public\.couple_invites[[:space:]]+as[[:space:]]+ci[[:space:]]+where[[:space:]]+ci\.id[[:space:]]*=[[:space:]]*v_invite_id[[:space:]]+and[[:space:]]+ci\.couple_id[[:space:]]*=[[:space:]]*v_couple_id[[:space:]]+and[[:space:]]+ci\.code_hash[[:space:]]*=[[:space:]]*v_code_hash[[:space:]]+for[[:space:]]+update',
  'redeem locks the selected public.couple_invites row by invite id before consuming it'
);

select ok(
  to_regclass('public.pairing_invites') is not null
    and to_regprocedure('public.create_pairing_invite(public.partner_identity)') is not null
    and to_regprocedure('public.redeem_pairing_invite(text)') is not null,
  'pairing uses a pending invite before choosing a new or historical couple'
);

select * from finish();
rollback;
