# Calendar Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the local-first couple calendar with multi-select invitation periods, coordinated date-state visuals, per-date photos and one daily journal, plus month/year/5-year views without losing existing data.

**Architecture:** Migrate the structured local database from v1 to v2 with backward-compatible invitation periods, daily notes, and view preferences. Keep binary photos behind a new IndexedDB `PhotoRepository`; keep a pure `summarizeDateState` function as the single source for all calendar scales. The existing route and repository boundaries remain, so the feature can later replace local storage with cloud adapters.

**Tech Stack:** React, TypeScript, date-fns, IndexedDB, browser Canvas/`createImageBitmap` for image compression, Vitest, Testing Library, Playwright.

---

## File map

- `src/domain/models.ts`, `src/domain/invitations.ts`, `src/domain/createInvitation.ts`: v2 period arrays and transition inputs.
- `src/domain/migrations.ts`, `src/domain/dateState.ts`: pure data migration and date-state aggregation.
- `src/storage/schema.ts`, `src/storage/localRepository.ts`: v2 structured storage and migration-on-read.
- `src/storage/photoRepository.ts`: IndexedDB metadata/blob storage with a repository interface.
- `src/features/calendar/`: reusable date details plus month, year, and five-year views.
- `src/features/invitations/`: multi-select form and adjustment UI.
- `src/features/memories/`: photo gallery/uploader and one daily journal.
- `src/styles/`: state color tokens, legend, view controls, gallery, and responsive rules.
- `src/app/App.tsx`, `src/app/useBookingData.ts`: repository wiring, recovery states, and view preference.
- `e2e/booking-flow.spec.ts`: multi-period, state rendering, photo, journal, and scale-switch workflows.

### Task 1: Migrate the structured data model to v2

**Files:**
- Modify: `src/domain/models.ts`
- Create: `src/domain/migrations.ts`
- Modify: `src/storage/schema.ts`
- Modify: `src/storage/localRepository.ts`
- Create: `src/domain/migrations.test.ts`
- Modify: `src/storage/localRepository.test.ts`

- [ ] **Step 1: Write failing migration tests**

```ts
it('migrates a v1 single period without changing the invitation identity', () => {
  const migrated = migrateDatabase({
    version: 1,
    availability: [],
    invitations: [{
      id: 'old', senderId: 'him', recipientId: 'her', date: '2026-07-25',
      period: 'evening', activity: '看电影', note: '', status: 'pending',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z',
      history: [{ id: 'h', actorId: 'him', action: 'created', createdAt: '2026-07-18T10:00:00.000Z' }],
    }],
    notifications: [],
  });
  expect(migrated.version).toBe(2);
  expect(migrated.invitations[0].periods).toEqual(['evening']);
  expect(migrated.invitations[0].id).toBe('old');
});

it('adds empty daily notes and a month view preference to a migrated database', () => {
  const migrated = migrateDatabase({ version: 1, availability: [], invitations: [], notifications: [] });
  expect(migrated.dailyNotes).toEqual([]);
  expect(migrated.viewPreference).toBe('month');
});
```

- [ ] **Step 2: Run the migration tests and verify the expected red state**

Run: `npm test -- src/domain/migrations.test.ts`

Expected: FAIL because v2 types and `migrateDatabase` do not exist.

- [ ] **Step 3: Define v2 types and an idempotent migration**

Change `Invitation.period` to `Invitation.periods: Period[]`; change `InvitationHistoryEntry.proposedPeriod` to `proposedPeriods: Period[]`. Add:

```ts
export type CalendarScale = 'month' | 'year' | 'five_years';

export interface DailyNote {
  date: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalDatabase {
  version: 2;
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
  dailyNotes: DailyNote[];
  viewPreference: CalendarScale;
}
```

`migrateDatabase` accepts v1 or v2, maps `period` to `[period]`, maps `proposedPeriod` to `[proposedPeriod]`, preserves history IDs/timestamps, creates empty notes, defaults `viewPreference` to `month`, and returns the same v2 value when called again.

- [ ] **Step 4: Make local repository migrate on read and persist once**

When the stored JSON parses as v1, migrate it and write the v2 value once before returning. Add `saveDailyNote`, `deleteDailyNote`, `saveViewPreference`, and `saveInvitationWithNotification` to the repository contract. A malformed or unsupported version still throws `本地数据无法读取`.

- [ ] **Step 5: Run migration, repository, and existing domain tests**

Run: `npm test -- src/domain/migrations.test.ts src/storage/localRepository.test.ts src/domain/invitations.test.ts`

Expected: all selected tests PASS, with v1 fixture data readable as v2.

- [ ] **Step 6: Commit the migration boundary**

```powershell
git add src/domain/models.ts src/domain/migrations.ts src/domain/migrations.test.ts src/storage/schema.ts src/storage/localRepository.ts src/storage/localRepository.test.ts
git commit -m "feat: migrate booking data to v2"
```

### Task 2: Support multi-select periods throughout invitation creation and responses

**Files:**
- Modify: `src/domain/createInvitation.ts`
- Modify: `src/domain/invitations.ts`
- Modify: `src/features/invitations/InvitationForm.tsx`
- Modify: `src/features/invitations/AdjustmentForm.tsx`
- Modify: `src/features/invitations/InvitationDetails.tsx`
- Modify: `src/domain/createInvitation.test.ts`
- Modify: `src/features/invitations/InvitationForm.test.tsx`
- Modify: `src/features/invitations/InvitationDetails.test.tsx`

- [ ] **Step 1: Write failing multi-period tests**

```ts
it('creates an invitation with every selected period', () => {
  const invitation = createInvitation({
    senderId: 'him', date: '2026-07-25', periods: ['morning', 'evening'],
    activity: '看电影', note: '',
  });
  expect(invitation.periods).toEqual(['morning', 'evening']);
});
```

```tsx
it('allows multiple periods in the invitation form', async () => {
  render(<InvitationForm partnerId="him" repository={repository} onSaved={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('日期'), '2026-07-25');
  await userEvent.click(screen.getByLabelText('下午'));
  await userEvent.click(screen.getByLabelText('晚上'));
  expect(screen.getByLabelText('下午')).toBeChecked();
  expect(screen.getByLabelText('晚上')).toBeChecked();
});
```

- [ ] **Step 2: Run the selected tests and verify they fail on the old scalar period API**

Run: `npm test -- src/domain/createInvitation.test.ts src/features/invitations/InvitationForm.test.tsx`

Expected: FAIL because creation and form state only accept one `period`.

- [ ] **Step 3: Change domain inputs and transition proposals to arrays**

Require a non-empty `periods` array, preserve the user’s order after removing duplicates, and copy `proposedPeriods` into adjustment history. Accepting an adjustment must replace the invitation’s `periods` with the latest proposed array. Reject empty arrays with `请至少选择一个时段`.

- [ ] **Step 4: Replace radio controls with independent checkboxes**

Use four checkboxes named `invitation-period` and `adjustment-period`. Do not enforce adjacency, auto-fill missing periods, or special-case `all_day`; store exactly the checked values. Render period summaries by joining their Chinese labels with `、`.

- [ ] **Step 5: Run full domain and invitation tests**

Run: `npm test -- src/domain src/features/invitations`

Expected: PASS for one-period legacy behavior, arbitrary multi-select combinations, adjustment acceptance, validation, and persistence.

- [ ] **Step 6: Commit multi-period invitations**

```powershell
git add src/domain src/features/invitations
git commit -m "feat: support multi-period invitations"
```

### Task 3: Add the pure date-state aggregator and semantic visual tokens

**Files:**
- Create: `src/domain/dateState.ts`
- Create: `src/domain/dateState.test.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/components.css`
- Create: `src/features/calendar/StatusLegend.tsx`

- [ ] **Step 1: Write failing aggregation tests**

```ts
it('gives confirmed events the primary fill while retaining all secondary marks', () => {
  const state = summarizeDateState({
    partnerId: 'her', date: '2026-07-25',
    availability: [
      { id: 'him:2026-07-25', ownerId: 'him', date: '2026-07-25', periods: ['evening'], note: '', updatedAt: '' },
      { id: 'her:2026-07-25', ownerId: 'her', date: '2026-07-25', periods: ['afternoon'], note: '', updatedAt: '' },
    ],
    invitations: [invitationBuilder({ status: 'confirmed', date: '2026-07-25', periods: ['evening'] })],
    hasPhoto: true,
    hasNote: true,
  });
  expect(state.primary).toBe('confirmed');
  expect(state.secondary).toEqual(expect.arrayContaining(['him_available', 'her_available']));
  expect(state.hasPhoto).toBe(true);
  expect(state.hasNote).toBe(true);
});
```

- [ ] **Step 2: Run the aggregator test and verify failure**

Run: `npm test -- src/domain/dateState.test.ts`

Expected: FAIL because the aggregator and v2 invitation fixture do not exist.

- [ ] **Step 3: Implement the state summary contract**

Define `primary: 'confirmed' | 'none'`, secondary values `him_available | her_available | needs_my_response | waiting_for_partner`, plus `hasPhoto` and `hasNote`. A pending invitation is `needs_my_response` when the current partner is recipient and `waiting_for_partner` when the current partner is sender. Confirmed is the only primary fill and never suppresses secondary values.

- [ ] **Step 4: Add semantic CSS tokens and a text legend**

Add tokens for confirmed fill, him available, her available, pending gold, photo marker, note marker, and focus states. Add `StatusLegend` with text labels and non-color symbols. Ensure the confirmed fill is soft, has a readable foreground, and secondary markers remain visible.

- [ ] **Step 5: Run aggregator, component, and build checks**

Run: `npm test -- src/domain/dateState.test.ts src/features/calendar && npm run build`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit state aggregation and tokens**

```powershell
git add src/domain/dateState.ts src/domain/dateState.test.ts src/styles src/features/calendar/StatusLegend.tsx
git commit -m "feat: add calendar date state summaries"
```

### Task 4: Implement IndexedDB photo storage and the daily photo gallery

**Files:**
- Create: `src/storage/photoRepository.ts`
- Create: `src/storage/photoRepository.test.ts`
- Create: `src/features/memories/PhotoGallery.tsx`
- Create: `src/features/memories/PhotoGallery.test.tsx`
- Modify: `src/features/calendar/DayPanel.tsx`

- [ ] **Step 1: Write failing repository tests**

```ts
it('stores and lists six photos for one date, then rejects the seventh', async () => {
  const repository = await createPhotoRepository('test-db');
  for (let index = 0; index < 6; index += 1) {
    await repository.add({ date: '2026-07-25', blob: new Blob(['x'], { type: 'image/jpeg' }), title: `photo ${index}` });
  }
  await expect(repository.add({ date: '2026-07-25', blob: new Blob(['x'], { type: 'image/jpeg' }), title: '' }))
    .rejects.toThrow('每天最多保存 6 张照片');
});
```

- [ ] **Step 2: Run the repository test and verify failure**

Run: `npm test -- src/storage/photoRepository.test.ts`

Expected: FAIL because the IndexedDB adapter does not exist.

- [ ] **Step 3: Implement the IndexedDB schema and adapter**

Create database `couple-date-booking-media`, object store `photos`, and indexes by `date` and `createdAt`. The `PhotoRepository` interface must expose `list(date)`, `add(input)`, `updateTitle(id, title)`, `delete(id)`, and `count(date)`. Store original compressed blob, thumbnail blob, title, date, createdAt, and order. Enforce the configured local limit of 6 per date before writing.

- [ ] **Step 4: Add browser compression before repository writes**

Use `createImageBitmap` and an offscreen canvas to correct orientation where supported, constrain the long edge to 1600px, export a JPEG/WebP blob, and create a 320px thumbnail. Reject non-image files and show a per-file error without clearing existing gallery state.

- [ ] **Step 5: Build the gallery and viewer**

The gallery shows count/limit, thumbnails, title text, upload control, and delete buttons. The viewer opens from a thumbnail, supports previous/next, closes with Escape, and has accessible labels. Delete requires a confirmation dialog. Add the gallery to `DayPanel` for every date, including dates without invitations.

- [ ] **Step 6: Run photo tests and the full suite**

Run: `npm test -- src/storage/photoRepository.test.ts src/features/memories/PhotoGallery.test.tsx && npm test`

Expected: photo repository/component tests and all existing tests PASS.

- [ ] **Step 7: Commit photo memories**

```powershell
git add src/storage/photoRepository* src/features/memories src/features/calendar/DayPanel.tsx
git commit -m "feat: add per-date photo memories"
```

### Task 5: Add one daily journal entry per date

**Files:**
- Modify: `src/app/repository.ts`
- Modify: `src/storage/localRepository.ts`
- Create: `src/features/memories/DailyNoteEditor.tsx`
- Create: `src/features/memories/DailyNoteEditor.test.tsx`
- Modify: `src/features/calendar/DayPanel.tsx`

- [ ] **Step 1: Write failing journal behavior tests**

```tsx
it('saves one editable note per date and shows the saved text after refresh', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  const { rerender } = render(<DailyNoteEditor date="2026-07-25" repository={repository} />);
  await user.type(screen.getByLabelText('记录标题'), '第一次看日落');
  await user.type(screen.getByLabelText('当天记录'), '风很舒服。');
  await user.click(screen.getByRole('button', { name: '保存记录' }));
  rerender(<DailyNoteEditor date="2026-07-25" repository={repository} />);
  expect(screen.getByDisplayValue('第一次看日落')).toBeInTheDocument();
  expect(screen.getByDisplayValue('风很舒服。')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the journal test and verify failure**

Run: `npm test -- src/features/memories/DailyNoteEditor.test.tsx`

Expected: FAIL because the editor and repository note methods are missing.

- [ ] **Step 3: Implement one-note-per-date repository operations**

Store notes in the v2 `dailyNotes` array keyed by `date`; `saveDailyNote` replaces the same date, `deleteDailyNote` removes it, and `getDailyNote` returns the current value. Trim title/body, require a non-empty body when saving, and update `updatedAt` on every save.

- [ ] **Step 4: Implement explicit save, unsaved warning, and delete confirmation**

The editor has title and multiline body fields, a dirty flag, Save button, and Delete button only when a saved note exists. Before date changes or unmount navigation, use a browser confirmation only when dirty. Clearing an existing note requires a dialog before deletion. Show `有未保存的修改` and `记录已保存` status text.

- [ ] **Step 5: Add note marker and integrate into DayPanel**

Pass `hasNote` from the structured database to the date state aggregator and render the editor beside the photo gallery. Notes are allowed when no appointment or photo exists.

- [ ] **Step 6: Run journal, migration, and full tests**

Run: `npm test -- src/features/memories/DailyNoteEditor.test.tsx src/domain/migrations.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit daily journals**

```powershell
git add src/app/repository.ts src/storage/localRepository.ts src/features/memories src/features/calendar/DayPanel.tsx
git commit -m "feat: add one daily journal entry"
```

### Task 6: Add month/year/five-year calendar scales

**Files:**
- Create: `src/features/calendar/CalendarScaleControl.tsx`
- Create: `src/features/calendar/YearCalendar.tsx`
- Create: `src/features/calendar/FiveYearCalendar.tsx`
- Create: `src/features/calendar/CalendarScaleControl.test.tsx`
- Create: `src/features/calendar/YearCalendar.test.tsx`
- Create: `src/features/calendar/FiveYearCalendar.test.tsx`
- Modify: `src/features/calendar/MonthCalendar.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing scale and navigation tests**

```tsx
it('switches from month to year and persists the preference', async () => {
  const user = userEvent.setup();
  render(<CalendarScaleControl scale="month" onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: '年' }));
  expect(onChange).toHaveBeenCalledWith('year');
});

it('opens the correct month when a year-view date is clicked', async () => {
  render(<YearCalendar year={2026} summaries={summaries} onSelectDate={onSelectDate} />);
  await userEvent.click(screen.getByRole('button', { name: '2026年7月25日' }));
  expect(onSelectDate).toHaveBeenCalledWith('2026-07-25');
});
```

- [ ] **Step 2: Run scale tests and verify failure**

Run: `npm test -- src/features/calendar/*CalendarScale* src/features/calendar/YearCalendar.test.tsx src/features/calendar/FiveYearCalendar.test.tsx`

Expected: FAIL because the scale controls and compact views do not exist.

- [ ] **Step 3: Implement shared scale state and preference persistence**

Use `CalendarScaleControl` with values `month`, `year`, and `five_years`. On change, call `repository.saveViewPreference(scale)` and render the corresponding view. Keep navigation state as an ISO year/month or five-year window start; do not duplicate date-state aggregation.

- [ ] **Step 4: Implement the year view**

Render 12 compact month grids. Each day keeps confirmed fill, secondary dots, photo marker, and note marker but omits detail text. Clicking a date calls `onSelectDate('yyyy-MM-dd')`, switches to month scale, and opens that date’s DayPanel.

- [ ] **Step 5: Implement the five-year view**

Render five year rows/cards with 12 month density cells. The month intensity is based on confirmed invitation count; the corner count is the number of distinct dates with a photo or note. Move backward/forward by exactly five years. Clicking a month switches to that month’s year/month context.

- [ ] **Step 6: Add responsive layout and legend integration**

Use vertical year cards on narrow screens and a multi-column layout at desktop widths. Keep the scale control and legend visible without horizontal scrolling. Confirmed fill remains the strongest signal in every view.

- [ ] **Step 7: Run calendar tests, build, and commit**

Run: `npm test -- src/features/calendar && npm run build`

Expected: all calendar tests PASS and the production build succeeds.

```powershell
git add src/features/calendar src/app/App.tsx
git commit -m "feat: add multi-scale calendar views"
```

### Task 7: Wire recovery, status summaries, and local limits into the application shell

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/useBookingData.ts`
- Modify: `src/features/calendar/MonthCalendar.tsx`
- Modify: `src/features/calendar/DayPanel.tsx`
- Modify: `src/app/DataRecoveryScreen.tsx`
- Modify: `src/styles/components.css`
- Create: `src/app/CalendarEnhancements.integration.test.tsx`

- [ ] **Step 1: Write failing integration tests**

```tsx
it('shows confirmed fill and both memory markers on a date', async () => {
  seedConfirmedInvitationWithAvailabilityAndMemories();
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: '7月25日' }));
  expect(screen.getByRole('button', { name: '7月25日' })).toHaveAttribute('data-primary-state', 'confirmed');
  expect(screen.getByLabelText('当天照片')).toBeInTheDocument();
  expect(screen.getByLabelText('当天记录')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the integration test and verify failure**

Run: `npm test -- src/app/CalendarEnhancements.integration.test.tsx`

Expected: FAIL because the existing shell only understands v1 period values and has no photo/note state wiring.

- [ ] **Step 3: Wire v2 database, IndexedDB, and summary inputs into App**

Create stable repository instances once, load photos/notes for the selected date, pass `DateSummary` to the active calendar view, and show the existing recovery screen for structured migration or IndexedDB initialization failures. Keep reset controls separate for structured data and media data.

- [ ] **Step 4: Add local configuration and explanatory legend**

Expose `MAX_LOCAL_PHOTOS_PER_DAY = 6` in one configuration module; show the limit in the gallery. Add labels for confirmed fill, both availability colors, pending invitation, photo, and note markers.

- [ ] **Step 5: Run full unit/component tests and build**

Run: `npm test && npm run build`

Expected: all existing and new tests PASS; no data-recovery screen appears for valid v1 or v2 data.

- [ ] **Step 6: Commit application integration**

```powershell
git add src/app src/features/calendar src/styles src/config
git commit -m "feat: wire calendar enhancement state"
```

### Task 8: Add end-to-end coverage and update beginner documentation

**Files:**
- Modify: `e2e/booking-flow.spec.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-19-calendar-enhancements.md`
- Modify: `docs/superpowers/specs/2026-07-19-calendar-enhancements-design.md`

- [ ] **Step 1: Add the real browser workflows**

Cover: selecting afternoon and evening together, seeing confirmed fill plus secondary markers, adding one compressed photo and title, writing a daily journal, switching month/year/five-year views, clicking back to a date, and verifying the data after reload.

- [ ] **Step 2: Run the new E2E tests in Chromium**

Run: `npm run e2e`

Expected: all existing and new workflows PASS, including the 390px no-horizontal-overflow check.

- [ ] **Step 3: Document the new behavior**

Update README with multi-period semantics, the four visual states and legend, local six-photo limit versus future cloud thirty-photo limit, daily one-note behavior, view switching, and separate local reset behavior for structured data and media.

- [ ] **Step 4: Run final verification**

Run: `npm test && npm run build && npm run e2e && git diff --check`

Expected: all tests pass, build exits 0, Chromium workflows pass, and Git reports no whitespace errors.

- [ ] **Step 5: Commit the verified enhancement**

```powershell
git add e2e README.md docs/superpowers
git commit -m "test: verify calendar enhancements"
```

