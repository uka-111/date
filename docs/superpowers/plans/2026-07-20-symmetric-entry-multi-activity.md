# Symmetric Entry and Multi-Activity Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the identity entrance symmetrical and allow one invitation or adjustment to contain multiple independently displayed activities.

**Architecture:** Keep the existing invitation aggregate, but change `Invitation.activity` and adjustment history values from one string to `string[]`. Add a version 3 local-data migration that wraps legacy strings in arrays, reuse a small `ActivityTags` renderer, and keep selection state inside the existing forms.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, localStorage repository, Playwright, CSS Grid.

---

### Task 1: Upgrade invitation activity data to arrays

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/storage/schema.ts`
- Modify: `src/domain/migrations.ts`
- Modify: `src/storage/localRepository.ts`
- Modify: `src/domain/migrations.test.ts`

- [ ] **Step 1: Write failing migration tests**

Add tests proving that a version 2 activity string and a version 1 period/activity string both become arrays:

```tsx
it('migrates v2 activity strings to v3 arrays', () => {
  const migrated = migrateDatabase({
    version: 2,
    availability: [],
    invitations: [{
      id: 'v2', senderId: 'him', recipientId: 'her', date: '2026-07-25',
      periods: ['evening'], activity: '看电影', note: '', status: 'pending',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z',
      history: [{ id: 'h1', actorId: 'him', action: 'created', createdAt: '2026-07-18T10:00:00.000Z' }],
    }],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  });

  expect(migrated.version).toBe(3);
  expect(migrated.invitations[0].activity).toEqual(['看电影']);
});

it('migrates legacy proposed activities to arrays', () => {
  const migrated = migrateDatabase({
    version: 2,
    availability: [],
    invitations: [{
      id: 'adjusted', senderId: 'him', recipientId: 'her', date: '2026-07-25',
      periods: ['evening'], activity: '看电影', note: '', status: 'adjustment_pending',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T11:00:00.000Z',
      history: [{
        id: 'h2', actorId: 'her', action: 'adjustment_suggested',
        createdAt: '2026-07-18T11:00:00.000Z', proposedDate: '2026-07-26',
        proposedPeriods: ['afternoon'], proposedActivity: '逛展',
      }],
    }],
    notifications: [], dailyNotes: [], viewPreference: 'month',
  });
  expect(migrated.invitations[0].history.at(-1)?.proposedActivity)
    .toEqual(['逛展']);
});
```

- [ ] **Step 2: Run the migration tests and verify RED**

Run: `npm test -- src/domain/migrations.test.ts`

Expected: FAIL because version 2 is returned unchanged and `activity` is still a string.

- [ ] **Step 3: Change the domain and schema types**

In `models.ts`:

```ts
export interface InvitationHistoryEntry {
  id: string;
  actorId: PartnerId;
  action: InvitationAction;
  createdAt: string;
  note?: string;
  proposedDate?: string;
  proposedPeriods?: Period[];
  proposedActivity?: string[];
}

export interface Invitation {
  id: string;
  senderId: PartnerId;
  recipientId: PartnerId;
  date: string;
  periods: Period[];
  activity: string[];
  note: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
  history: InvitationHistoryEntry[];
}
```

In `schema.ts`, change the current version in both declarations:

```ts
export interface LocalDatabase {
  version: 3;
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
  dailyNotes: DailyNote[];
  viewPreference: CalendarScale;
}

export function emptyDatabase(): LocalDatabase {
  return {
    version: 3,
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  };
}
```

- [ ] **Step 4: Implement v1/v2 to v3 normalization**

Define legacy invitation types with string activities and normalize every invitation:

```ts
function toActivities(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function normalizeInvitation(invitation: LegacyInvitationV1 | LegacyInvitationV2): Invitation {
  const periods = 'periods' in invitation ? invitation.periods : [invitation.period];
  return {
    ...invitation,
    periods,
    activity: toActivities(invitation.activity),
    history: invitation.history.map((entry) => ({
      ...entry,
      proposedPeriods: entry.proposedPeriods ??
        (entry.proposedPeriod ? [entry.proposedPeriod] : undefined),
      proposedActivity: entry.proposedActivity
        ? toActivities(entry.proposedActivity)
        : undefined,
    })),
  };
}
```

Return version 3 for v1/v2 input and return version 3 input unchanged. Update `isDatabase` to accept versions 1, 2, and 3, and write migrated data whenever the parsed version is not 3.

- [ ] **Step 5: Run migration tests and verify GREEN**

Run: `npm test -- src/domain/migrations.test.ts`

Expected: all migration tests PASS.

- [ ] **Step 6: Commit the migration**

```powershell
git add src/domain/models.ts src/storage/schema.ts src/domain/migrations.ts src/storage/localRepository.ts src/domain/migrations.test.ts
git commit -m "feat: migrate invitation activities to arrays"
```

### Task 2: Create and validate invitations with multiple activities

**Files:**
- Modify: `src/domain/createInvitation.ts`
- Modify: `src/domain/createInvitation.test.ts`
- Modify: `src/test/builders.ts`

- [ ] **Step 1: Write failing domain tests**

```ts
it('creates an invitation with unique trimmed activities', () => {
  const invitation = createInvitation({
    senderId: 'him',
    date: '2026-07-25',
    periods: ['evening'],
    activity: [' 看电影 ', '一起吃饭', '看电影'],
    note: '',
  });

  expect(invitation.activity).toEqual(['看电影', '一起吃饭']);
});

it('rejects an invitation without activities', () => {
  expect(() => createInvitation({
    senderId: 'him', date: '2026-07-25', periods: ['evening'], activity: [], note: '',
  })).toThrow('请完整填写日期、时段和活动');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/domain/createInvitation.test.ts`

Expected: FAIL because `createInvitation` expects a string.

- [ ] **Step 3: Implement array normalization**

```ts
interface CreateInvitationInput {
  senderId: PartnerId;
  date: string;
  periods: Period[];
  activity: string[];
  note: string;
}

const activity = [...new Set(input.activity.map((item) => item.trim()).filter(Boolean))];
if (!input.date || periods.length === 0 || activity.length === 0) {
  throw new Error('请完整填写日期、时段和活动');
}
```

Update `invitationBuilder` so its default is `activity: ['看电影']`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/domain/createInvitation.test.ts`

Expected: all create-invitation tests PASS.

- [ ] **Step 5: Commit the domain change**

```powershell
git add src/domain/createInvitation.ts src/domain/createInvitation.test.ts src/test/builders.ts
git commit -m "feat: create invitations with multiple activities"
```

### Task 3: Add multi-select behavior to the invitation form

**Files:**
- Modify: `src/features/invitations/InvitationForm.tsx`
- Modify: `src/features/invitations/InvitationForm.test.tsx`

- [ ] **Step 1: Write failing form tests**

```tsx
it('saves multiple preset activities', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(<InvitationForm partnerId="him" repository={repository} onSaved={vi.fn()} />);

  await user.type(screen.getByLabelText('日期'), '2026-07-25');
  await user.click(screen.getByLabelText('晚上'));
  await user.click(screen.getByRole('button', { name: '一起吃饭' }));
  await user.click(screen.getByRole('button', { name: '看电影' }));
  await user.click(screen.getByRole('button', { name: '发送约会邀请' }));

  expect(repository.read().invitations[0].activity)
    .toEqual(['一起吃饭', '看电影']);
});

it('combines a preset activity with a custom activity', async () => {
  // select 看电影 and 自定义, enter 逛展, submit
  expect(repository.read().invitations[0].activity)
    .toEqual(['看电影', '逛展']);
});
```

- [ ] **Step 2: Run the form tests and verify RED**

Run: `npm test -- src/features/invitations/InvitationForm.test.tsx`

Expected: FAIL because selecting the second activity currently replaces the first.

- [ ] **Step 3: Implement independent toggles**

Replace the single activity state with:

```ts
const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
const [customSelected, setCustomSelected] = useState(false);

function toggleActivity(value: string) {
  setSelectedActivities((current) =>
    current.includes(value)
      ? current.filter((activity) => activity !== value)
      : [...current, value],
  );
}

const activities = [
  ...selectedActivities,
  ...(customSelected && customActivity.trim() ? [customActivity.trim()] : []),
];
```

Each preset button uses `aria-pressed={selectedActivities.includes(option.value)}`. The custom button toggles `customSelected`. Validation requires at least one preset or custom selection, and requires custom text only while custom is selected. Pass `activities` to `createInvitation` and reset all three activity states after saving.

- [ ] **Step 4: Run the form tests and verify GREEN**

Run: `npm test -- src/features/invitations/InvitationForm.test.tsx`

Expected: all invitation-form tests PASS.

- [ ] **Step 5: Commit the form change**

```powershell
git add src/features/invitations/InvitationForm.tsx src/features/invitations/InvitationForm.test.tsx
git commit -m "feat: allow multiple activities in invitations"
```

### Task 4: Preserve multiple activities during adjustments

**Files:**
- Modify: `src/domain/invitations.ts`
- Modify: `src/domain/invitations.test.ts`
- Modify: `src/features/invitations/AdjustmentForm.tsx`
- Modify: `src/features/invitations/InvitationDetails.test.tsx`

- [ ] **Step 1: Write failing adjustment tests**

Update the response test to suggest two activities and accept them:

```ts
const suggested = respondToInvitation(invitation, 'her', {
  type: 'suggest-adjustment',
  date: '2026-07-26',
  periods: ['afternoon'],
  activity: ['逛展', '一起吃饭'],
});

expect(suggested.history.at(-1)?.proposedActivity)
  .toEqual(['逛展', '一起吃饭']);

const accepted = respondToInvitation(suggested, 'him', { type: 'accept-adjustment' });
expect(accepted.activity).toEqual(['逛展', '一起吃饭']);
```

Add a component test that edits an adjustment and submits more than one activity.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/domain/invitations.test.ts src/features/invitations/InvitationDetails.test.tsx`

Expected: FAIL because adjustment responses and the input still use strings.

- [ ] **Step 3: Implement adjustment arrays**

Change the response type and normalization:

```ts
type InvitationResponse =
  | { type: 'confirm' }
  | { type: 'reject'; note?: string }
  | { type: 'cancel'; note?: string }
  | {
      type: 'suggest-adjustment';
      date: string;
      periods: Period[];
      activity: string[];
      note?: string;
    }
  | { type: 'accept-adjustment' };

const proposedActivity = response.type === 'suggest-adjustment'
  ? [...new Set(response.activity.map((item) => item.trim()).filter(Boolean))]
  : undefined;
```

Reject an empty proposed activity array. In `AdjustmentForm`, use the same preset/custom multi-select rules as the invitation form and initialize known presets from `invitation.activity`; put any unknown activity into the custom field.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/domain/invitations.test.ts src/features/invitations/InvitationDetails.test.tsx`

Expected: both test files PASS.

- [ ] **Step 5: Commit adjustment support**

```powershell
git add src/domain/invitations.ts src/domain/invitations.test.ts src/features/invitations/AdjustmentForm.tsx src/features/invitations/InvitationDetails.test.tsx
git commit -m "feat: support multiple activities in adjustments"
```

### Task 5: Render activities as independent tags

**Files:**
- Create: `src/features/invitations/ActivityTags.tsx`
- Create: `src/features/invitations/ActivityTags.test.tsx`
- Modify: `src/features/invitations/InvitationList.tsx`
- Modify: `src/features/invitations/InvitationDetails.tsx`
- Modify: `src/styles/components.css`

- [ ] **Step 1: Write a failing tag-renderer test**

```tsx
it('renders every activity as its own tag', () => {
  render(<ActivityTags activities={['一起吃饭', '看电影']} />);
  expect(screen.getByText('一起吃饭')).toHaveClass('activity-tag');
  expect(screen.getByText('看电影')).toHaveClass('activity-tag');
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run: `npm test -- src/features/invitations/ActivityTags.test.tsx`

Expected: FAIL because `ActivityTags` does not exist.

- [ ] **Step 3: Add the reusable renderer**

```tsx
export function ActivityTags({ activities }: { activities: string[] }) {
  return (
    <span className="activity-tags" aria-label="约会活动">
      {activities.map((activity) => (
        <span className="activity-tag" key={activity}>{activity}</span>
      ))}
    </span>
  );
}
```

Use it inside invitation list cards, the details heading, and the latest-adjustment section.

Add styles:

```css
.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.activity-tag {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--cocoa);
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Run invitation UI tests and verify GREEN**

Run: `npm test -- src/features/invitations/ActivityTags.test.tsx src/features/invitations/InvitationList.test.tsx src/features/invitations/InvitationDetails.test.tsx`

Expected: all selected UI tests PASS.

- [ ] **Step 5: Commit tag rendering**

```powershell
git add src/features/invitations/ActivityTags.tsx src/features/invitations/ActivityTags.test.tsx src/features/invitations/InvitationList.tsx src/features/invitations/InvitationDetails.tsx src/styles/components.css
git commit -m "feat: display booking activities as tags"
```

### Task 6: Make the identity entrance symmetrical

**Files:**
- Modify: `src/features/session/EntryScreen.tsx`
- Modify: `src/features/session/EntryScreen.test.tsx`
- Modify: `src/styles/components.css`
- Modify: `e2e/booking-flow.spec.ts`

- [ ] **Step 1: Write a failing structure test**

```tsx
it('renders two identity cards inside a dedicated options group', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText('专属口令'), '2021121');
  await user.click(screen.getByRole('button', { name: '进入我们的日历' }));

  const group = screen.getByRole('group', { name: '今天是谁在使用？' });
  expect(within(group).getAllByRole('button')).toHaveLength(2);
  expect(within(group).getByRole('button', { name: '我是他' }))
    .toHaveClass('identity-option');
  expect(within(group).getByRole('button', { name: '我是她' }))
    .toHaveClass('identity-option');
});
```

- [ ] **Step 2: Run the entry test and verify RED**

Run: `npm test -- src/features/session/EntryScreen.test.tsx`

Expected: FAIL because there is no dedicated options group or identity card class.

- [ ] **Step 3: Implement the selected A layout**

```tsx
<section className="identity-choice" aria-labelledby="identity-heading">
  <h2 id="identity-heading">今天是谁在使用？</h2>
  <div className="identity-options" role="group" aria-labelledby="identity-heading">
    <button className="identity-option" type="button" onClick={() => selectPartner('him')}>
      <span aria-hidden="true">☀️</span><span>我是他</span>
    </button>
    <button className="identity-option" type="button" onClick={() => selectPartner('her')}>
      <span aria-hidden="true">🌙</span><span>我是她</span>
    </button>
  </div>
</section>
```

```css
.identity-choice { display: block; text-align: center; }
.identity-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.entry-card .identity-option { min-height: 92px; display: grid; place-items: center; align-content: center; gap: 4px; }
@media (max-width: 360px) { .identity-options { grid-template-columns: 1fr; } }
```

Update the mobile E2E flow to unlock the entry and assert that the two option bounding boxes have equal width and height before continuing.

- [ ] **Step 4: Run entry and browser tests and verify GREEN**

Run: `npm test -- src/features/session/EntryScreen.test.tsx`

Run: `npm run e2e`

Expected: entry tests and both Chromium flows PASS; identity cards have matching dimensions.

- [ ] **Step 5: Commit the entrance redesign**

```powershell
git add src/features/session/EntryScreen.tsx src/features/session/EntryScreen.test.tsx src/styles/components.css e2e/booking-flow.spec.ts
git commit -m "fix: make identity entrance symmetrical"
```

### Task 7: Full regression verification

**Files:**
- Modify only if a regression is found in files already listed above.

- [ ] **Step 1: Run all unit and component tests**

Run: `npm test`

Expected: all test files PASS with zero failures.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 3: Run complete browser verification**

Run: `npm run e2e`

Expected: the two-partner booking flow and mobile layout tests PASS.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check HEAD~6..HEAD`

Expected: no whitespace errors.

- [ ] **Step 5: Confirm the branch is ready for local review**

Run: `git status --short --branch`

Expected: only intentionally ignored visual-companion files or local server logs remain untracked; all product changes are committed.
