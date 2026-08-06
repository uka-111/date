# Cloud Shared Data and Realtime Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move availability, invitations, history, notifications, daily notes, and calendar preference from local browser storage to the paired couple's protected Supabase data with realtime refresh.

**Architecture:** PostgreSQL tables and transaction RPCs are the consistency boundary. React reads one asynchronous `BookingSnapshot`; mutation methods accept intent rather than browser-authored actor IDs or timestamps. Supabase Realtime only invalidates the snapshot, and the client then re-fetches authoritative rows.

**Tech Stack:** React, TypeScript, Supabase Postgres/RLS/RPC/Realtime, Vitest, Testing Library, pgTAP, Playwright

---

## File Map

- Create `supabase/migrations/202607210002_shared_booking_data.sql`: shared tables, indexes, RLS, and mutation RPCs.
- Create `supabase/tests/shared_booking_data.test.sql`: role, state-machine, and isolation tests.
- Create `src/app/bookingRepository.ts`: async intent-based repository contract.
- Create `src/app/bookingSnapshot.ts`: snapshot type and empty value.
- Create `src/storage/supabaseMappers.ts`: database-row/domain mappings.
- Create `src/storage/supabaseBookingRepository.ts`: cloud implementation and realtime subscription.
- Create `src/test/fakeBookingRepository.ts`: deterministic async test repository.
- Modify `src/app/useBookingData.ts`: load/error/retry/realtime state.
- Modify all calendar, invitation, notification, and note components to await intent mutations.
- Retain `src/storage/localRepository.ts` only for legacy migration tests; production must not import it.

### Task 1: Add Shared Tables, Constraints, and RLS

**Files:**
- Create: `supabase/migrations/202607210002_shared_booking_data.sql`
- Regenerate: `src/lib/database.types.ts`

- [ ] **Step 1: Create constrained business tables**

The migration must create:

```sql
create type public.invitation_status as enum ('pending','adjustment_pending','confirmed','rejected','cancelled');
create type public.invitation_action as enum ('created','confirmed','rejected','cancelled','adjustment_suggested','adjustment_accepted');
create type public.notification_kind as enum ('created','adjusted','confirmed','rejected','cancelled');

create table public.availabilities (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict, date date not null,
  periods text[] not null, note text not null default '', updated_at timestamptz not null default now(),
  unique (couple_id, owner_id, date),
  check (cardinality(periods) > 0 and periods <@ array['all_day','morning','afternoon','evening'])
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  date date not null, periods text[] not null, activities text[] not null, note text not null default '',
  status public.invitation_status not null default 'pending', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), check (sender_id <> recipient_id),
  check (cardinality(periods) > 0 and periods <@ array['all_day','morning','afternoon','evening']),
  check (cardinality(activities) > 0 and array_position(activities, '') is null)
);

create table public.invitation_events (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict, action public.invitation_action not null,
  note text, proposed_date date, proposed_periods text[], proposed_activities text[], created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  kind public.notification_kind not null, created_at timestamptz not null default now(), read_at timestamptz
);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  date date not null, title text not null default '', body text not null, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(couple_id,date),
  check (char_length(trim(body)) > 0)
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  calendar_scale text not null default 'month' check (calendar_scale in ('month','year','five_years')),
  updated_at timestamptz not null default now()
);
```

Add indexes on every `couple_id`, on `invitations(couple_id,date,status)`, `notifications(recipient_id,read_at)`, and `invitation_events(invitation_id,created_at)`.

- [ ] **Step 2: Enable RLS and restrict mutation paths**

For every shared table, permit `select` only when `public.is_couple_member(couple_id)`. Permit availability upsert only when `owner_id = auth.uid()` and the row's `couple_id = public.current_couple_id()`. Permit notification update only for `recipient_id = auth.uid()` and only through a dedicated RPC. Permit preference select/upsert only for `user_id = auth.uid()`. Do not grant browser roles direct insert/update/delete on invitations, events, notifications, or daily notes.

- [ ] **Step 3: Reset locally and regenerate types**

Run: `npx supabase db reset`

Run: `npx supabase gen types typescript --local --schema public > src/lib/database.types.ts`

Expected: all six new tables and enums appear in generated types.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/202607210002_shared_booking_data.sql src/lib/database.types.ts
git commit -m "feat: add protected shared booking schema"
```

### Task 2: Add Atomic Mutation RPCs and Database Tests

**Files:**
- Modify: `supabase/migrations/202607210002_shared_booking_data.sql`
- Create: `supabase/tests/shared_booking_data.test.sql`

- [ ] **Step 1: Write failing pgTAP tests for every mutation**

Create paired users A/B and outsider C. Test `save_availability`, `create_invitation`, `respond_to_invitation`, `mark_notification_read`, `save_daily_note`, `delete_daily_note`, and `save_user_preference`. Assert exact row counts, actor IDs, event order, notification recipients, and unchanged state after every rejected call.

Required state assertions:

```sql
select throws_ok($$ select public.respond_to_invitation(:'invitation', 'confirm', null, null, null, null) $$,
  'not allowed', 'sender cannot confirm own pending invitation');
select is((select status::text from public.invitations where id = :'invitation'), 'pending',
  'rejected transition leaves invitation unchanged');
select is((select count(*) from public.invitation_events where invitation_id = :'invitation')::int, 1,
  'rejected transition creates no event');
select is((select count(*) from public.notifications where invitation_id = :'invitation')::int, 1,
  'rejected transition creates no notification');
```

Cover pending -> confirmed/rejected/adjustment_pending/cancelled, adjustment_pending -> confirmed/cancelled, the correct actor for each transition, and outsider isolation.

- [ ] **Step 2: Run and verify failure**

Run: `npx supabase test db`

Expected: FAIL because RPCs do not exist.

- [ ] **Step 3: Implement exact intent RPCs**

```sql
public.save_availability(p_date date, p_periods text[], p_note text) returns public.availabilities
public.create_invitation(p_date date, p_periods text[], p_activities text[], p_note text) returns uuid
public.respond_to_invitation(p_invitation_id uuid, p_action text, p_note text default null,
  p_date date default null, p_periods text[] default null, p_activities text[] default null) returns void
public.mark_notification_read(p_notification_id uuid) returns void
public.save_daily_note(p_date date, p_title text, p_body text) returns public.daily_notes
public.delete_daily_note(p_date date) returns void
public.save_user_preference(p_calendar_scale text) returns void
```

Every definer RPC must set `search_path`, derive user and couple from `auth.uid()`, lock the invitation before validating a transition, compute the partner from `couple_members`, and write the invitation/event/notification in the same transaction. The browser supplies no sender, recipient, actor, status, timestamp, or couple ID.

- [ ] **Step 4: Pass database tests and commit**

Run: `npx supabase db reset && npx supabase test db`

Expected: all pairing and shared-data pgTAP tests PASS.

```powershell
git add supabase/migrations/202607210002_shared_booking_data.sql supabase/tests/shared_booking_data.test.sql
git commit -m "feat: add atomic booking mutation functions"
```

### Task 3: Define the Async Repository and Test Double

**Files:**
- Create: `src/app/bookingSnapshot.ts`
- Create: `src/app/bookingRepository.ts`
- Create: `src/test/fakeBookingRepository.ts`
- Create: `src/test/fakeBookingRepository.test.ts`

- [ ] **Step 1: Write a failing contract test**

Assert that a fresh fake loads an empty snapshot, mutations return promises, a subscriber fires once after a mutation, and a forced failure does not mutate state.

- [ ] **Step 2: Define the complete async contract**

```ts
export interface BookingSnapshot {
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
  dailyNotes: DailyNote[];
  viewPreference: CalendarScale;
}

export interface DateBookingRepository {
  load(): Promise<BookingSnapshot>;
  saveAvailability(input: { date: string; periods: Period[]; note: string }): Promise<void>;
  createInvitation(input: { date: string; periods: Period[]; activities: string[]; note: string }): Promise<string>;
  respondToInvitation(id: string, response: InvitationResponse): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  saveDailyNote(input: { date: string; title: string; body: string }): Promise<void>;
  deleteDailyNote(date: string): Promise<void>;
  saveViewPreference(scale: CalendarScale): Promise<void>;
  subscribe(onChange: () => void): () => void;
}
```

The fake accepts seeded data and `failNext(message)` for loading/mutation failure tests. Keep the old local repository against a renamed `LegacyLocalRepository` interface so existing migration tests remain meaningful without constraining production APIs.

- [ ] **Step 3: Run and commit**

Run: `npm test -- src/test/fakeBookingRepository.test.ts`

Expected: all repository contract tests PASS.

```powershell
git add src/app/bookingSnapshot.ts src/app/bookingRepository.ts src/test/fakeBookingRepository.ts src/test/fakeBookingRepository.test.ts src/storage/localRepository.ts
git commit -m "refactor: define asynchronous booking repository"
```

### Task 4: Implement Supabase Mapping, Loading, and Realtime Invalidation

**Files:**
- Create: `src/storage/supabaseMappers.ts`
- Create: `src/storage/supabaseMappers.test.ts`
- Create: `src/storage/supabaseBookingRepository.ts`
- Create: `src/storage/supabaseBookingRepository.test.ts`

- [ ] **Step 1: Write failing mapper tests**

Use snake_case fixtures and assert exact domain output, including mapping user UUIDs to `him`/`her`, grouping ordered `invitation_events` into each invitation's history, and rejecting unknown enum values with `云端数据格式不受支持`.

- [ ] **Step 2: Implement pure mappers**

Export `mapAvailability`, `mapInvitation`, `mapNotification`, `mapDailyNote`, and `mapSnapshot`. Pass a `Map<string, PartnerId>` built from the two membership rows; never infer identity from sender order.

- [ ] **Step 3: Write failing repository tests with a typed Supabase mock**

Assert `load()` requests current-couple rows, sorts events, defaults missing preferences to `month`, calls the exact RPC for each mutation, maps PostgREST errors to Chinese messages, and creates one channel filtered to the current `couple_id` for shared tables plus `user_id` for preferences.

- [ ] **Step 4: Implement the Supabase repository**

`load()` must fetch memberships first, then fetch availability, invitations with events, notifications, notes, and preference in parallel. `subscribe()` listens for postgres changes and debounces invalidations into one callback per microtask; cleanup calls `supabase.removeChannel(channel)`. Reconnection to `SUBSCRIBED` after an error must trigger one fresh invalidation.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/storage/supabaseMappers.test.ts src/storage/supabaseBookingRepository.test.ts`

Expected: mapper and repository tests PASS.

```powershell
git add src/storage/supabaseMappers.ts src/storage/supabaseMappers.test.ts src/storage/supabaseBookingRepository.ts src/storage/supabaseBookingRepository.test.ts
git commit -m "feat: add Supabase booking repository"
```

### Task 5: Add Loading, Retry, Offline, and Realtime React State

**Files:**
- Modify: `src/app/useBookingData.ts`
- Create: `src/app/useBookingData.test.tsx`
- Create: `src/app/BookingDataScreen.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing hook tests**

Test `loading -> ready`, load failure with retry, retained snapshot during refresh, subscriber invalidation, cleanup, and `navigator.onLine = false` disabling mutations without erasing loaded data.

```ts
export type BookingDataState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: BookingSnapshot; refreshing: boolean; online: boolean }
  | { status: 'error'; message: string };
```

- [ ] **Step 2: Implement the hook**

Expose `{ state, reload, runMutation }`. `runMutation` rejects immediately with `网络已断开，恢复连接后再试` when offline, leaves form inputs owned by the component unchanged on failure, awaits the write, then reloads before reporting success.

- [ ] **Step 3: Wire paired sessions to cloud data**

Create `supabaseBookingRepository` from the paired `coupleId` and `userId`. Render a loading screen before the first snapshot, an error screen with “重试”, and `AuthenticatedApp` only with a ready snapshot. Remove `CloudSetupScreen` and all production imports of `createLocalRepository`.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/app/useBookingData.test.tsx src/app/App.test.tsx`

Expected: loading, error, retry, and paired app tests PASS.

```powershell
git add src/app
git commit -m "feat: load shared booking data asynchronously"
```

### Task 6: Convert Feature Components to Intent Mutations

**Files:**
- Modify: `src/features/calendar/CalendarWorkspace.tsx`
- Modify: `src/features/calendar/MonthCalendar.tsx`
- Modify: `src/features/calendar/DayPanel.tsx`
- Modify: `src/features/calendar/AvailabilityEditor.tsx`
- Modify: `src/features/invitations/InvitationForm.tsx`
- Modify: `src/features/invitations/InvitationDetails.tsx`
- Modify: `src/features/memories/DailyNoteEditor.tsx`
- Modify: `src/features/notifications/NotificationList.tsx`
- Modify: related `*.test.tsx` files

- [ ] **Step 1: Replace tests with the async fake repository**

Use `await user.click(...)` and `await waitFor(...)` for every mutation. Add assertions that buttons show `保存中...` or `发送中...`, remain disabled during a write, show no success before resolution, preserve form input after rejection, and show success only after the refreshed snapshot arrives.

- [ ] **Step 2: Update components one workflow at a time**

Availability sends `{ date, periods, note }`; invitation creation sends `{ date, periods, activities, note }`; invitation details sends only ID plus `InvitationResponse`; notes send `{ date, title, body }`; notification read sends only its ID. Remove all client-generated UUIDs, actor IDs, recipient IDs, statuses, and timestamps from mutation components.

- [ ] **Step 3: Remove synchronous reads from render paths**

Pass `BookingSnapshot` values as props. No component may call `repository.read()` or `repository.getDailyNote()`. Verify with:

Run: `rg -n "repository\.(read|getDailyNote)|crypto\.randomUUID" src/features src/app`

Expected: no matches in production feature or app files.

- [ ] **Step 4: Run all tests and commit**

Run: `npm test && npm run build`

Expected: the full suite and build pass.

```powershell
git add src
git commit -m "refactor: use cloud mutation intents in features"
```

### Task 7: Hosted Migration and Two-Device Realtime Acceptance

**Files:**
- Modify: `e2e/booking-flow.spec.ts`
- Modify: `docs/supabase-setup.md`
- Modify: `README.md`

- [ ] **Step 1: Dry-run then push migration 002**

Run: `npx supabase db push --dry-run`

Expected: only `202607210002_shared_booking_data.sql` is pending.

Run: `npx supabase db push`

- [ ] **Step 2: Enable required Realtime tables**

Add the shared tables to the `supabase_realtime` publication in the migration itself, then re-run local reset before pushing. Do not rely on an undocumented Dashboard click.

- [ ] **Step 3: Extend opt-in cloud E2E**

Use two browser contexts already paired in Phase 1. A saves availability and B observes it without reload; A creates a multi-activity invitation; B receives a notification, suggests an adjustment, and A accepts it; both see confirmed state. Repeat for daily-note save/delete and preference persistence after reload.

- [ ] **Step 4: Final verification and commit**

Run: `npx supabase test db && npm test && npm run build && npm run e2e`

Expected: all database and frontend tests pass; cloud tests either explicitly skip without credentials or pass with two accounts.

```powershell
git add e2e/booking-flow.spec.ts docs/supabase-setup.md README.md
git commit -m "test: verify two-device cloud synchronization"
```

## Phase Acceptance

- Both members see the same availability, invitations, history, notifications, and notes.
- Every state transition creates exactly one immutable event and one appropriate notification.
- Another couple and anonymous users cannot read or mutate the data.
- Realtime changes appear without a manual reload and reconnect triggers a fresh snapshot.
- First load, refresh, write failure, retry, and offline states are distinct.
- Existing local browser test data remains untouched and is never uploaded.
