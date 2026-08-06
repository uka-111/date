# Cloud Photos and Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private, compressed cloud photo synchronization and deploy the completed two-person app to Vercel with correct Supabase Auth settings.

**Architecture:** The browser compresses compatible images, uploads to a private couple-scoped Storage path, then inserts metadata; failed metadata writes trigger compensating object deletion. Reads use short-lived signed URLs. A protected Supabase Edge Function performs idempotent photo deletion so the service-role key never enters browser code.

**Tech Stack:** React, TypeScript, Canvas API, heic2any, Supabase Storage/Postgres/Edge Functions, Vitest, Playwright, Vercel

---

## File Map

- Create `supabase/migrations/202607210003_private_photos.sql`: metadata table, limits, bucket, and Storage RLS.
- Create `supabase/tests/private_photos.test.sql`: metadata and path isolation tests.
- Create `supabase/functions/delete-photo/index.ts`: authenticated, idempotent delete operation.
- Create `src/media/imageProcessor.ts`: HEIC conversion, resize, compression, metadata.
- Create `src/storage/supabasePhotoRepository.ts`: upload/list/signed URL/delete implementation.
- Modify `src/storage/photoRepository.ts`: cloud-friendly interfaces only.
- Modify `src/features/memories/PhotoGallery.tsx`: per-file progress and retry UI.
- Create `vercel.json`: SPA fallback and security headers.
- Modify `docs/supabase-setup.md` and `README.md`: deployment and recovery instructions.

### Task 1: Add Private Photo Metadata, Limits, and Storage Policies

**Files:**
- Create: `supabase/migrations/202607210003_private_photos.sql`
- Create: `supabase/tests/private_photos.test.sql`
- Regenerate: `src/lib/database.types.ts`

- [ ] **Step 1: Write the metadata table and server-side limit**

```sql
create table public.daily_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  date date not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  title text not null default '',
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  check (storage_path like couple_id::text || '/' || date::text || '/%')
);
create index daily_photos_couple_date on public.daily_photos(couple_id,date,sort_order,created_at);
```

Add a `before insert` trigger that locks on `pg_advisory_xact_lock(hashtextextended(couple_id::text || date::text, 0))`, rejects a count of 30 with `每天最多保存 30 张照片`, derives `couple_id` and `uploaded_by` from `auth.uid()`, and assigns the next `sort_order`. The browser cannot choose another couple or uploader.

- [ ] **Step 2: Create a private bucket and path policies in the migration**

Insert bucket `date-photos` with `public = false`, 10 MB file limit, and allowed MIME types JPEG/PNG/WebP. Storage object policies must parse `(storage.foldername(name))[1]` as the couple UUID and require `public.is_couple_member(...)` for select/insert/delete. Insert additionally requires `owner_id = auth.uid()`.

Grant metadata select to couple members and insert only through `public.create_daily_photo(p_date,p_storage_path,p_title,p_mime_type,p_width,p_height,p_size_bytes)`. No browser role receives direct update/delete.

- [ ] **Step 3: Write and run pgTAP tests**

Test the 30-photo limit, MIME/path constraints, automatic uploader/couple fields, outsider isolation, anonymous denial, and inability to insert metadata for a path under another couple.

Run: `npx supabase db reset && npx supabase test db`

Expected: all database tests PASS.

- [ ] **Step 4: Regenerate types and commit**

Run: `npx supabase gen types typescript --local --schema public > src/lib/database.types.ts`

```powershell
git add supabase/migrations/202607210003_private_photos.sql supabase/tests/private_photos.test.sql src/lib/database.types.ts
git commit -m "feat: add private cloud photo storage"
```

### Task 2: Process Browser Images Before Upload

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/media/imageProcessor.ts`
- Create: `src/media/imageProcessor.test.ts`

- [ ] **Step 1: Install HEIC conversion and write failing tests**

Run: `npm install heic2any`

Mock `createImageBitmap`, canvas, and `heic2any`. Test: JPEG passthrough into processing, HEIC conversion to JPEG, longest edge reduced to 2048 px without enlarging small images, output JPEG/WebP quality `0.82`, and exact Chinese error when conversion fails.

- [ ] **Step 2: Implement the processor contract**

```ts
export interface ProcessedImage {
  blob: Blob;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  extension: 'jpg' | 'png' | 'webp';
}

export async function processImage(file: File): Promise<ProcessedImage>;
```

Accept JPEG, PNG, WebP, HEIC, and HEIF by MIME type or extension. Convert HEIC/HEIF with `heic2any`, resize using a canvas with a 2048-pixel longest edge, preserve PNG only when it has transparency, otherwise encode JPEG at 0.82. Reject output over 10 MB with `图片压缩后仍超过 10 MB`.

- [ ] **Step 3: Verify and commit**

Run: `npm test -- src/media/imageProcessor.test.ts && npm run build`

Expected: processor tests pass and TypeScript recognizes the library declaration.

```powershell
git add package.json package-lock.json src/media
git commit -m "feat: compress photos before cloud upload"
```

### Task 3: Implement Signed Photo Reads and Compensated Uploads

**Files:**
- Modify: `src/storage/photoRepository.ts`
- Create: `src/storage/supabasePhotoRepository.ts`
- Create: `src/storage/supabasePhotoRepository.test.ts`

- [ ] **Step 1: Define the cloud photo contract and failing tests**

```ts
export interface PhotoRecord {
  id: string; date: string; title: string; previewUrl: string;
  width: number; height: number; createdAt: string; order: number;
}
export type UploadStage = 'processing' | 'uploading' | 'saving' | 'complete';
export interface PhotoRepository {
  list(date: string): Promise<PhotoRecord[]>;
  add(input: { date: string; file: File; title: string; onStage(stage: UploadStage): void }): Promise<PhotoRecord>;
  delete(id: string): Promise<void>;
  count(date: string): Promise<number>;
}
export const MAX_CLOUD_PHOTOS_PER_DAY = 30;
```

Test path format `<coupleId>/<date>/<uuid>.<ext>`, signed URL expiry of 3600 seconds, processing/uploading/saving/complete stage order, 30-photo rejection before processing, and compensating Storage removal when metadata RPC fails.

- [ ] **Step 2: Implement list and add**

`list` selects metadata for the date, calls `createSignedUrls(paths, 3600)`, and maps URLs by path. `add` processes the image, uploads with `upsert: false`, calls `create_daily_photo`, removes the just-uploaded object if the RPC fails, then reloads and returns the matching record. Map offline, unsupported HEIC, count-limit, Storage, and metadata failures to distinct Chinese messages.

- [ ] **Step 3: Verify and commit**

Run: `npm test -- src/storage/supabasePhotoRepository.test.ts`

Expected: all repository tests PASS, including compensation.

```powershell
git add src/storage/photoRepository.ts src/storage/supabasePhotoRepository.ts src/storage/supabasePhotoRepository.test.ts
git commit -m "feat: upload private photos with signed previews"
```

### Task 4: Add Protected, Idempotent Photo Deletion

**Files:**
- Create: `supabase/functions/delete-photo/index.ts`
- Create: `supabase/functions/delete-photo/index.test.ts`
- Modify: `src/storage/supabasePhotoRepository.ts`
- Modify: `src/storage/supabasePhotoRepository.test.ts`

- [ ] **Step 1: Write failing Edge Function tests**

Test missing bearer token -> 401, missing ID -> 400, outsider -> 404, member delete -> 204, and a retry after the object is already absent -> 204 with metadata removed.

- [ ] **Step 2: Implement the function**

Create an authenticated Supabase client from the request authorization header to identify the caller and select visible metadata. Create a server-only admin client from `SUPABASE_SERVICE_ROLE_KEY`, remove the Storage path while treating “not found” as success, then delete the metadata row. Never return the storage path to an unauthorized caller and never log tokens or keys.

```ts
if (request.method !== 'DELETE') return new Response('Method not allowed', { status: 405 });
const { id } = await request.json();
// authenticate -> membership-visible metadata -> storage remove -> metadata delete
return new Response(null, { status: 204 });
```

- [ ] **Step 3: Call the function from the repository**

`PhotoRepository.delete(id)` invokes `delete-photo` with `{ method: 'DELETE', body: { id } }`; map non-2xx responses to `照片删除失败，请重试` and keep the gallery item visible until deletion succeeds.

- [ ] **Step 4: Verify and commit**

Run: `deno test supabase/functions/delete-photo/index.test.ts`

Run: `npm test -- src/storage/supabasePhotoRepository.test.ts`

Expected: Edge Function and client repository tests PASS.

```powershell
git add supabase/functions/delete-photo src/storage/supabasePhotoRepository.ts src/storage/supabasePhotoRepository.test.ts
git commit -m "feat: delete cloud photos through protected function"
```

### Task 5: Build Multi-file Progress and Retry UI

**Files:**
- Modify: `src/features/memories/PhotoGallery.tsx`
- Modify: `src/features/memories/PhotoGallery.test.tsx`
- Modify: `src/features/calendar/CalendarWorkspace.tsx`
- Modify: `src/styles/components.css`

- [ ] **Step 1: Write failing UI tests**

Select three files and assert three stable upload rows. Resolve/reject fake uploads independently and assert each row shows one of `正在处理`, `正在上传`, `正在保存`, `已完成`, or the exact error; failed rows retain a “重试” button. Assert count displays `0/30`, signed URLs are used directly, delete failure leaves the photo visible, and long filenames do not overflow at 320 px.

- [ ] **Step 2: Implement upload item state**

```ts
interface UploadItem {
  id: string;
  file: File;
  stage: UploadStage | 'failed';
  error: string;
}
```

Start at most two uploads concurrently. Preserve failed items for retry, clear completed items after the refreshed list renders, revoke no object URLs because cloud previews are signed HTTP URLs, and disable add/delete controls while offline.

- [ ] **Step 3: Wire the cloud photo repository**

Create it with the paired couple/user context in the same composition root as `supabaseBookingRepository`; do not instantiate IndexedDB in production. Realtime changes on `daily_photos` must trigger both snapshot refresh and gallery reload.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/memories/PhotoGallery.test.tsx && npm run build`

Expected: progress, retry, count, delete, and responsive tests PASS.

```powershell
git add src/features/memories src/features/calendar src/styles src/app
git commit -m "feat: show cloud photo upload progress"
```

### Task 6: Deploy Database, Function, and Vercel App

**Files:**
- Create: `vercel.json`
- Modify: `docs/supabase-setup.md`
- Modify: `README.md`
- Modify: `e2e/booking-flow.spec.ts`

- [ ] **Step 1: Verify and push the final database migration**

Run: `npx supabase db push --dry-run`

Expected: only `202607210003_private_photos.sql` is pending.

Run: `npx supabase db push`

- [ ] **Step 2: Deploy the deletion function**

Run: `npx supabase functions deploy delete-photo --project-ref agakrexkrsqjxqsotzxd`

Expected: function deploy succeeds. Supabase provides `SUPABASE_URL`, anon key, and service-role key inside the function runtime; none are added to Git or Vercel browser variables.

- [ ] **Step 3: Add SPA deployment configuration**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ]
  }]
}
```

- [ ] **Step 4: Create the Vercel project with public variables only**

Import `uka-111/date` in Vercel, choose Vite, set production branch `master`, and add `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY`. Do not add database password, secret key, or service-role key. Deploy and record the generated HTTPS URL.

- [ ] **Step 5: Update Supabase Auth URLs**

Set Supabase Auth Site URL to the Vercel production URL. Keep local Redirect URLs and add `<vercel-url>/**` plus Vercel preview pattern(s) actually used by the project. Register the production origin in any Storage/CORS configuration required by the Dashboard.

- [ ] **Step 6: Run complete two-account acceptance**

On two devices: restore sessions after browser close, save availability, create/adjust/confirm an invitation, mark notification read, save/edit/delete a note, upload JPEG/PNG/WebP and one HEIC, view signed images, delete one image, and verify realtime appearance. In an anonymous window and a third account, verify shared rows and photo URLs are inaccessible.

- [ ] **Step 7: Final automated verification and commit**

Run: `npx supabase test db && npm test && npm run build && npm run e2e`

Expected: database tests, frontend tests, production build, responsive local E2E, and credentialed cloud E2E all pass.

```powershell
git add vercel.json docs/supabase-setup.md README.md e2e/booking-flow.spec.ts
git commit -m "docs: deploy the cloud date booking app"
```

## Phase Acceptance

- Photos are private, limited to 30 per couple/date, and displayed through expiring signed URLs.
- JPEG, PNG, WebP, and HEIC input work or produce a precise compatibility error.
- Metadata failure cleans up the uploaded object; deletion is authenticated and retry-safe.
- Each selected file has independent progress, failure reason, and retry.
- Vercel contains only public Supabase browser variables.
- The production URL supports route refresh, persistent login, two-device realtime data, and private photos.
