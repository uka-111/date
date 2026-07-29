# Personal Cloud Memories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver private, per-person cloud photos and daily notes with a `我的/对方` read-only switch, compact photo deletion control, then deploy the tested application.

**Architecture:** Extend the Supabase schema so note and photo ownership is derived from `auth.uid()`. Store photo metadata in Postgres and bytes in a private Storage bucket, expose signed preview URLs through a focused photo repository, and retain UI authorization at the component boundary while RLS/RPC enforce it on the server.

**Tech Stack:** React, TypeScript, Vite, Vitest, Supabase Postgres/Storage/RLS/Realtime, Playwright, Vercel.

---

## File Map

- Create: `supabase/migrations/202607300001_personal_cloud_memories.sql`
- Create: `supabase/tests/personal_cloud_memories.test.sql`
- Create: `src/storage/supabasePhotoRepository.ts`, `supabase/functions/delete-daily-photo/index.ts`
- Create: `src/storage/supabasePhotoRepository.test.ts`
- Create: `src/features/memories/PhotoGallery.test.tsx`
- Modify: `src/domain/models.ts`, `src/app/bookingSnapshot.ts`, `src/app/bookingRepository.ts`, `src/app/cloudUiAdapter.ts`, `src/test/fakeBookingRepository.ts`
- Modify: `src/storage/supabaseBookingRepository.ts`, `src/storage/supabaseMappers.ts`, `src/lib/database.types.ts`
- Modify: `src/features/memories/DailyNoteEditor.tsx`, `src/features/memories/PhotoGallery.tsx`, `src/features/calendar/DayPanel.tsx`, `src/app/BookingDataScreen.tsx`, `src/styles/components.css`

### Task 1: Prove the new database ownership contract

**Files:**
- Create: `supabase/tests/personal_cloud_memories.test.sql`
- Modify: `supabase/tests/shared_booking_data.test.sql`

- [ ] **Step 1: Write failing pgTAP assertions for individual notes and photos**

```sql
select plan(12);
select lives_ok($$select public.save_daily_note('2026-08-12', 'A', 'A 的记录')$$, 'A saves own note');
select is((select count(*)::integer from public.daily_notes where date = '2026-08-12'), 1, 'one note exists');
-- switch request.jwt.claim.sub to member B, then save another same-day note
select is((select count(*)::integer from public.daily_notes where date = '2026-08-12'), 2, 'each partner owns one note');
select throws_ok($$delete from public.daily_notes where created_by = 'A UUID'$$, '42501', null, 'partner cannot delete another note');
select throws_ok($$select * from public.daily_photos$$, '42501', null, 'anonymous cannot read photo metadata');
```

- [ ] **Step 2: Run the database test and verify it fails because the table/constraint is missing**

Run: `npx supabase test db --test-path supabase/tests/personal_cloud_memories.test.sql`

Expected: FAIL while `daily_photos` and personal note uniqueness do not exist.

- [ ] **Step 3: Add the migration with server-derived ownership and private Storage policies**

```sql
alter table public.daily_notes drop constraint daily_notes_couple_id_date_key;
alter table public.daily_notes add constraint daily_notes_couple_date_creator_key unique (couple_id, date, created_by);

create table public.daily_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  date date not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  check (storage_path like couple_id::text || '/' || date::text || '/%')
);
create index daily_photos_couple_date_uploader_idx on public.daily_photos (couple_id, date, uploaded_by, created_at);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('date-photos', 'date-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
```

Create `create_daily_photo(p_date, p_storage_path, p_mime_type)` as a `security definer` function. It derives `couple_id` and `uploaded_by` from `auth.uid()`, rejects invalid paths/MIME types and a personal count of 30, then returns the inserted row. Replace `save_daily_note` and `delete_daily_note` so their `where` clauses include `created_by = auth.uid()`. Add table and Storage policies: active couple members may select; only `auth.uid()` may create/delete own metadata and own objects under their active couple path. Add `daily_photos` to the realtime publication.

- [ ] **Step 4: Run the database suite and regenerate TypeScript types**

Run: `npx supabase test db`

Expected: PASS, including personal note and photo isolation assertions.

Run: `npx supabase gen types typescript --local --schema public > src/lib/database.types.ts`

- [ ] **Step 5: Commit the migration and database tests**

```powershell
git add supabase/migrations/202607300001_personal_cloud_memories.sql supabase/tests/personal_cloud_memories.test.sql src/lib/database.types.ts
git commit -m "feat: add personal cloud memories schema"
```

### Task 2: Carry ownership through application data

**Files:**
- Modify: `src/domain/models.ts`, `src/app/bookingSnapshot.ts`, `src/app/bookingRepository.ts`
- Modify: `src/storage/supabaseMappers.ts`, `src/storage/supabaseBookingRepository.ts`, `src/test/fakeBookingRepository.ts`
- Test: `src/storage/supabaseMappers.test.ts`, `src/storage/supabaseBookingRepository.test.ts`

- [ ] **Step 1: Write failing mapper and fake-repository tests**

```ts
expect(mapDailyNote({ created_by: memberA, date: '2026-08-12', title: 'A', body: 'text', created_at: now, updated_at: now }, identities))
  .toMatchObject({ ownerId: 'him', date: '2026-08-12' });
await repository.saveDailyNote({ date: '2026-08-12', title: 'mine', body: 'body' });
expect((await repository.load()).dailyNotes[0].ownerId).toBe('him');
```

- [ ] **Step 2: Run those tests and verify the missing `ownerId` failure**

Run: `npm test -- src/storage/supabaseMappers.test.ts src/storage/supabaseBookingRepository.test.ts src/test/fakeBookingRepository.test.ts`

Expected: FAIL because notes do not yet include an owner.

- [ ] **Step 3: Add explicit memory types and parallel snapshot loading**

```ts
export interface DailyNote { ownerId: PartnerId; date: string; title: string; body: string; createdAt: string; updatedAt: string; }
export interface DailyPhoto { id: string; ownerId: PartnerId; date: string; previewUrl: string; mimeType: string; createdAt: string; }
```

Extend `BookingSnapshot` with `dailyPhotos`. Map `daily_notes.created_by` and `daily_photos.uploaded_by` through the existing identities map. Load `daily_photos` with the existing `Promise.all`, subscribe to its changes, and update fake data persistence so save/delete only affect `currentUserId` entries.

- [ ] **Step 4: Re-run the targeted tests and commit**

Run: `npm test -- src/storage/supabaseMappers.test.ts src/storage/supabaseBookingRepository.test.ts src/test/fakeBookingRepository.test.ts`

Expected: PASS.

```powershell
git add src/domain/models.ts src/app/bookingSnapshot.ts src/app/bookingRepository.ts src/storage/supabaseMappers.ts src/storage/supabaseBookingRepository.ts src/test/fakeBookingRepository.ts src/storage/*.test.ts
git commit -m "feat: load personal memory ownership"
```

### Task 3: Add a private Supabase photo repository and protected deletion

**Files:**
- Create: `src/storage/supabasePhotoRepository.ts`, `src/storage/supabasePhotoRepository.test.ts`, `supabase/functions/delete-daily-photo/index.ts`, `supabase/functions/delete-daily-photo/index.test.ts`
- Modify: `src/storage/photoRepository.ts`, `src/app/BookingDataScreen.tsx`

- [ ] **Step 1: Write failing repository tests for paths, signatures, limits, and deletion**

```ts
await repository.add({ date: '2026-08-12', file: new File(['x'], 'sunset.jpg', { type: 'image/jpeg' }) });
expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/^couple-id\/2026-08-12\/[\w-]+\.jpg$/), expect.any(File), { upsert: false });
expect(client.rpc).toHaveBeenCalledWith('create_daily_photo', expect.objectContaining({ p_date: '2026-08-12' }));
expect(storage.createSignedUrl).toHaveBeenCalledWith('couple-id/2026-08-12/photo.jpg', 3600);
```

- [ ] **Step 2: Run the test to verify the module is absent**

Run: `npm test -- src/storage/supabasePhotoRepository.test.ts`

Expected: FAIL because `createSupabasePhotoRepository` does not exist.

- [ ] **Step 3: Implement the minimal repository**

```ts
export interface CloudPhotoRepository {
  list(date: string, ownerId: PartnerId): Promise<DailyPhoto[]>;
  add(input: { date: string; file: File }): Promise<void>;
  delete(photo: DailyPhoto): Promise<void>;
}
```

Validate JPEG/PNG/WebP and 10 MB before upload. Generate the object path with `crypto.randomUUID()`, upload privately, call `create_daily_photo`, and remove the newly uploaded object when the RPC fails. For reads, call `createSignedUrl(path, 3600)` and keep only successful signed URLs.

Create `delete-daily-photo` as an authenticated Edge Function. It reads the bearer token, uses the user-scoped client to select a metadata row visible to the caller and require `uploaded_by = user.id`, then uses a server-only service-role client to remove the object and delete the row. Treat a missing storage object as already deleted, but never return an object path. `PhotoRepository.delete` calls this function and preserves the UI item for any non-2xx response. Compose this repository in `BookingDataScreen` using the existing authenticated Supabase client and current couple/user IDs, replacing `createPhotoRepository()` in the production screen.

- [ ] **Step 4: Run tests and commit**

Run: `deno test supabase/functions/delete-daily-photo/index.test.ts && npm test -- src/storage/supabasePhotoRepository.test.ts && npm run build`

Expected: PASS and build exit code 0.

```powershell
git add src/storage/photoRepository.ts src/storage/supabasePhotoRepository.ts src/storage/supabasePhotoRepository.test.ts supabase/functions/delete-daily-photo src/app/BookingDataScreen.tsx
git commit -m "feat: store new photos in private cloud storage"
```

### Task 4: Make memory views personal and read-only for the partner

**Files:**
- Modify: `src/app/cloudUiAdapter.ts`, `src/features/memories/DailyNoteEditor.tsx`, `src/features/memories/PhotoGallery.tsx`, `src/features/calendar/DayPanel.tsx`
- Create: `src/features/memories/PhotoGallery.test.tsx`
- Modify: `src/features/memories/DailyNoteEditor.test.tsx`

- [ ] **Step 1: Write failing UI tests for owner selection and read-only mode**

```tsx
render(<DayPanel date="2026-08-12" partnerId="him" dailyNotes={[hisNote, herNote]} dailyPhotos={[hisPhoto, herPhoto]} {...props} />);
expect(screen.getByRole('button', { name: '我的' })).toHaveAttribute('aria-pressed', 'true');
await user.click(screen.getByRole('button', { name: '对方' }));
expect(screen.queryByRole('button', { name: '保存记录' })).not.toBeInTheDocument();
expect(screen.queryByLabelText('添加照片')).not.toBeInTheDocument();
expect(screen.getByText('她的记录')).toBeVisible();
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run: `npm test -- src/features/memories/DailyNoteEditor.test.tsx src/features/memories/PhotoGallery.test.tsx`

Expected: FAIL because there is no owner switch or read-only rendering.

- [ ] **Step 3: Implement the switch and data filtering without client-side permission shortcuts**

Add a `MemoryOwnerSwitch` inside `DayPanel`, initialized to `partnerId`, with two small `aria-pressed` buttons named `我的` and `对方`. Pass the selected owner and `readOnly={selectedOwner !== partnerId}` to both memory components. Filter notes/photos by `ownerId` before passing data. In read-only mode, render note title/body as text and omit file input, save/delete controls and photo delete controls. Keep the photo viewer available in both modes.

- [ ] **Step 4: Re-run the UI tests and commit**

Run: `npm test -- src/features/memories/DailyNoteEditor.test.tsx src/features/memories/PhotoGallery.test.tsx`

Expected: PASS.

```powershell
git add src/app/cloudUiAdapter.ts src/features/memories src/features/calendar/DayPanel.tsx
git commit -m "feat: switch between personal and partner memories"
```

### Task 5: Replace photo captions and deletion text with compact overlay control

**Files:**
- Modify: `src/features/memories/PhotoGallery.tsx`, `src/styles/components.css`
- Test: `src/features/memories/PhotoGallery.test.tsx`

- [ ] **Step 1: Write failing regression tests**

```tsx
expect(screen.queryByText('sunset')).not.toBeInTheDocument();
const remove = screen.getByRole('button', { name: '删除当天照片' });
expect(remove).toHaveClass('photo-delete');
vi.spyOn(window, 'confirm').mockReturnValue(false);
await user.click(remove);
expect(deletePhoto).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the photo-gallery test and verify it fails**

Run: `npm test -- src/features/memories/PhotoGallery.test.tsx`

Expected: FAIL because captions and the text button still render.

- [ ] **Step 3: Implement the accessible overlay button and mobile-safe style**

Render each image in a positioned figure, remove `figcaption`, and place `<button className="photo-delete" aria-label="删除当天照片">×</button>` after the image button. Stop event propagation on deletion so it cannot open the viewer. Use a 28 px circular visual with a 36 px touch target through padding/negative inset, positioned at the top-right, and retain the exact confirmation message. Do not render the button for read-only content.

- [ ] **Step 4: Verify, build, and commit**

Run: `npm test -- src/features/memories/PhotoGallery.test.tsx && npm run build`

Expected: PASS and build exit code 0.

```powershell
git add src/features/memories/PhotoGallery.tsx src/features/memories/PhotoGallery.test.tsx src/styles/components.css
git commit -m "feat: simplify photo deletion control"
```

### Task 6: Run full verification and deploy in a staged order

**Files:**
- Modify only if verification reveals a defect.

- [ ] **Step 1: Establish a clean baseline and run every automated check**

Run: `npm test && npm run build && npm run e2e && npx supabase test db`

Expected: all frontend, E2E, build and database tests PASS.

- [ ] **Step 2: Apply and verify the production migration**

Run: `npx supabase db push --dry-run`

Expected: only `202607300001_personal_cloud_memories.sql` pending.

Run: `npx supabase db push`

Expected: migration applies successfully.

- [ ] **Step 3: Deploy the protected deletion function**

Run: `npx supabase functions deploy delete-daily-photo`

Expected: function deploy succeeds; its runtime owns any service-role secret and no secret is added to source control or Vercel browser variables.

- [ ] **Step 4: Deploy the reviewed branch and confirm the actual production route**

```powershell
git push origin HEAD:master
```

Wait for the Vercel deployment, then check `https://keptdays.vercel.app/` and an authenticated calendar day on desktop and mobile. Verify one member’s upload and note appear on the other device; the partner view has no editable fields or delete `×`; the owner view has the compact `×` and its confirmation dialog.

- [ ] **Step 5: Record the evidence before declaring completion**

Run: `git status --short; git log -1 --oneline`

Expected: clean worktree and a committed deployed revision.
