# Couple Date Booking Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first, mobile-friendly private web app where either partner can publish availability, invite the other to a date, and manage the invitation through confirmation, adjustment, rejection, or cancellation.

**Architecture:** Use a React single-page app with pure TypeScript domain functions, feature-scoped UI components, and repository interfaces that isolate browser storage from business logic. Persist the first version in `localStorage`; keep repository contracts stable so a later cloud adapter can replace local persistence without rewriting screens or state transitions.

**Tech Stack:** Vite, React 19, TypeScript, React Router, date-fns, Vitest, Testing Library, Playwright, CSS custom properties.

---

## File map

- `src/domain/`: identities, availability, invitations, notifications, validation, and state transitions with no React dependency.
- `src/storage/`: versioned local data schema and repository implementation.
- `src/app/`: router, session provider, application shell, and shared hooks.
- `src/features/calendar/`: month view, day details, and availability editing.
- `src/features/invitations/`: invitation form, details, response actions, and grouped lists.
- `src/features/notifications/`: unread counter and notification list.
- `src/styles/`: tokens, layout, components, responsive rules, and reduced-motion behavior.
- `src/test/`: test setup and builders.
- `e2e/`: complete two-person workflows in a real browser.

### Task 1: Scaffold the React application and test harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`

- [ ] **Step 1: Create package metadata and scripts**

```json
{
  "name": "couple-date-booking",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "date-fns": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: exit code 0 and a generated `package-lock.json`.

- [ ] **Step 3: Write the first failing shell test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('shows the private app entry screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '留一页给我们' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test and verify failure**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `App` and the test setup do not exist yet.

- [ ] **Step 5: Add the Vite, TypeScript, test setup, and minimal app files**

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
```

```tsx
// src/app/App.tsx
export function App() {
  return <h1>留一页给我们</h1>;
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Run unit tests and build**

Run: `npm test && npm run build`

Expected: all tests PASS and Vite creates `dist/`.

- [ ] **Step 7: Commit the scaffold**

```powershell
git add package.json package-lock.json index.html tsconfig.json vite.config.ts src
git commit -m "chore: scaffold date booking app"
```

### Task 2: Define the domain model and invitation state machine

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/invitations.ts`
- Create: `src/domain/invitations.test.ts`
- Create: `src/test/builders.ts`

- [ ] **Step 1: Write failing transition tests**

```ts
// src/domain/invitations.test.ts
import { invitationBuilder } from '../test/builders';
import { respondToInvitation } from './invitations';

it('allows only the recipient to confirm', () => {
  const invitation = invitationBuilder({ senderId: 'him', recipientId: 'her' });
  expect(() => respondToInvitation(invitation, 'him', { type: 'confirm' }))
    .toThrow('只有接收方可以确认这个约会');
  expect(respondToInvitation(invitation, 'her', { type: 'confirm' }).status)
    .toBe('confirmed');
});

it('preserves the original proposal when an adjustment is suggested', () => {
  const invitation = invitationBuilder({ date: '2026-07-25', period: 'evening' });
  const result = respondToInvitation(invitation, 'her', {
    type: 'suggest-adjustment',
    date: '2026-07-26',
    period: 'afternoon',
    activity: '逛展',
    note: '下午人少一点',
  });
  expect(result.date).toBe('2026-07-25');
  expect(result.status).toBe('adjustment_pending');
  expect(result.history.at(-1)?.proposedDate).toBe('2026-07-26');
});

it('applies the latest adjustment when the original sender accepts it', () => {
  const adjusted = respondToInvitation(invitationBuilder(), 'her', {
    type: 'suggest-adjustment', date: '2026-07-26', period: 'afternoon', activity: '逛展',
  });
  const confirmed = respondToInvitation(adjusted, 'him', { type: 'accept-adjustment' });
  expect(confirmed).toMatchObject({
    date: '2026-07-26', period: 'afternoon', activity: '逛展', status: 'confirmed',
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain/invitations.test.ts`

Expected: FAIL because the models and transition function are missing.

- [ ] **Step 3: Define stable domain types**

```ts
// src/domain/models.ts
export type PartnerId = 'him' | 'her';
export type Period = 'all_day' | 'morning' | 'afternoon' | 'evening';
export type InvitationStatus =
  | 'pending'
  | 'adjustment_pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

export interface Availability {
  id: string;
  ownerId: PartnerId;
  date: string;
  periods: Period[];
  note: string;
  updatedAt: string;
}

export interface InvitationHistoryEntry {
  id: string;
  actorId: PartnerId;
  action: 'created' | 'confirmed' | 'rejected' | 'cancelled' | 'adjustment_suggested' | 'adjustment_accepted';
  createdAt: string;
  note?: string;
  proposedDate?: string;
  proposedPeriod?: Period;
  proposedActivity?: string;
}

export interface Invitation {
  id: string;
  senderId: PartnerId;
  recipientId: PartnerId;
  date: string;
  period: Period;
  activity: string;
  note: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
  history: InvitationHistoryEntry[];
}
```

- [ ] **Step 4: Add explicit transition rules**

```ts
// src/domain/invitations.ts
import type { Invitation, PartnerId, Period } from './models';

type Response =
  | { type: 'confirm' }
  | { type: 'reject'; note?: string }
  | { type: 'cancel'; note?: string }
  | { type: 'suggest-adjustment'; date: string; period: Period; activity: string; note?: string }
  | { type: 'accept-adjustment' };

export function respondToInvitation(
  invitation: Invitation,
  actorId: PartnerId,
  response: Response,
  now = new Date().toISOString(),
): Invitation {
  if (invitation.status === 'rejected' || invitation.status === 'cancelled') {
    throw new Error('这个约会已经结束，不能再次修改');
  }
  if (response.type === 'accept-adjustment' && invitation.status !== 'adjustment_pending') {
    throw new Error('当前没有等待接受的调整建议');
  }
  if ((response.type === 'confirm' || response.type === 'reject' || response.type === 'suggest-adjustment') &&
      invitation.status !== 'pending') {
    throw new Error('当前状态不能执行这个操作');
  }
  if (response.type === 'cancel') {
    if (actorId !== invitation.senderId) throw new Error('只有发起方可以取消这个约会');
  } else if (response.type === 'accept-adjustment') {
    if (actorId !== invitation.senderId) throw new Error('只有原发起方可以接受调整');
  } else if (actorId !== invitation.recipientId) {
    throw new Error('只有接收方可以确认这个约会');
  }

  const action = response.type === 'suggest-adjustment' ? 'adjustment_suggested' :
    response.type === 'accept-adjustment' ? 'adjustment_accepted' :
    response.type === 'confirm' ? 'confirmed' :
    response.type === 'reject' ? 'rejected' : 'cancelled';
  const status = response.type === 'suggest-adjustment' ? 'adjustment_pending' :
    response.type === 'accept-adjustment' || response.type === 'confirm' ? 'confirmed' :
    response.type === 'reject' ? 'rejected' : 'cancelled';

  const acceptedAdjustment = response.type === 'accept-adjustment'
    ? [...invitation.history].reverse().find((entry) => entry.action === 'adjustment_suggested')
    : undefined;
  if (response.type === 'accept-adjustment' &&
      (!acceptedAdjustment?.proposedDate || !acceptedAdjustment.proposedPeriod || !acceptedAdjustment.proposedActivity)) {
    throw new Error('没有可以接受的调整建议');
  }

  return {
    ...invitation,
    date: acceptedAdjustment?.proposedDate ?? invitation.date,
    period: acceptedAdjustment?.proposedPeriod ?? invitation.period,
    activity: acceptedAdjustment?.proposedActivity ?? invitation.activity,
    status,
    updatedAt: now,
    history: [...invitation.history, {
      id: crypto.randomUUID(), actorId, action, createdAt: now,
      note: 'note' in response ? response.note : undefined,
      proposedDate: response.type === 'suggest-adjustment' ? response.date : undefined,
      proposedPeriod: response.type === 'suggest-adjustment' ? response.period : undefined,
      proposedActivity: response.type === 'suggest-adjustment' ? response.activity : undefined,
    }],
  };
}
```

- [ ] **Step 5: Run the domain tests**

Run: `npm test -- src/domain/invitations.test.ts`

Expected: PASS for recipient permissions, status transitions, and history preservation.

- [ ] **Step 6: Commit the domain model**

```powershell
git add src/domain src/test/builders.ts
git commit -m "feat: define invitation domain rules"
```

### Task 3: Add versioned local persistence

**Files:**
- Create: `src/storage/schema.ts`
- Create: `src/storage/localRepository.ts`
- Create: `src/storage/localRepository.test.ts`
- Create: `src/app/repository.ts`

- [ ] **Step 1: Write failing repository tests**

```ts
it('returns an empty versioned database when storage is empty', () => {
  const repository = createLocalRepository(localStorage);
  expect(repository.read()).toEqual({ version: 1, availability: [], invitations: [], notifications: [] });
});

it('keeps two invitations in the same date period', () => {
  const repository = createLocalRepository(localStorage);
  repository.saveInvitation(invitationBuilder({ id: 'one' }));
  repository.saveInvitation(invitationBuilder({ id: 'two' }));
  expect(repository.read().invitations).toHaveLength(2);
});

it('offers a reset path for invalid stored JSON', () => {
  localStorage.setItem('couple-date-booking', '{broken');
  expect(() => createLocalRepository(localStorage).read()).toThrow('本地数据无法读取');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/storage/localRepository.test.ts`

Expected: FAIL because the repository is not defined.

- [ ] **Step 3: Define the persisted schema and repository contract**

```ts
// src/storage/schema.ts
import type { Availability, Invitation, PartnerId } from '../domain/models';

export interface NotificationRecord {
  id: string;
  recipientId: PartnerId;
  invitationId: string;
  kind: 'created' | 'adjusted' | 'confirmed' | 'rejected' | 'cancelled';
  createdAt: string;
  readAt: string | null;
}

export interface LocalDatabase {
  version: 1;
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
}
```

```ts
// src/app/repository.ts
import type { Availability, Invitation, PartnerId } from '../domain/models';
import type { LocalDatabase, NotificationRecord } from '../storage/schema';

export interface DateBookingRepository {
  read(): LocalDatabase;
  saveAvailability(value: Availability): void;
  saveInvitation(value: Invitation): void;
  saveNotification(value: NotificationRecord): void;
  saveInvitationWithNotification(invitation: Invitation, notification: NotificationRecord): void;
  markNotificationRead(id: string, partnerId: PartnerId, readAt: string): void;
  reset(): void;
}
```

- [ ] **Step 4: Implement localStorage serialization by ID**

Use key `couple-date-booking`; start from `{ version: 1, availability: [], invitations: [], notifications: [] }`; replace matching IDs during saves and append new IDs. `saveInvitationWithNotification` updates both arrays in one in-memory database value and performs one `localStorage.setItem` call. Parse errors must throw `本地数据无法读取` and `reset()` must remove only this application key.

- [ ] **Step 5: Run repository tests and the full suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit persistence**

```powershell
git add src/storage src/app/repository.ts
git commit -m "feat: persist booking data locally"
```

### Task 4: Build the private entry and identity session

**Files:**
- Create: `src/app/SessionProvider.tsx`
- Create: `src/features/session/EntryScreen.tsx`
- Create: `src/features/session/EntryScreen.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing identity flow tests**

```tsx
it('requires the shared passphrase before identity selection', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText('专属口令'), 'wrong');
  await user.click(screen.getByRole('button', { name: '进入我们的日历' }));
  expect(screen.getByText('口令不正确')).toBeInTheDocument();
});

it('remembers the selected partner in session storage', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText('专属口令'), '2021121');
  await user.click(screen.getByRole('button', { name: '进入我们的日历' }));
  await user.click(screen.getByRole('button', { name: '我是她' }));
  expect(sessionStorage.getItem('couple-date-partner')).toBe('her');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/session/EntryScreen.test.tsx`

Expected: FAIL because the entry flow is missing.

- [ ] **Step 3: Implement the session provider and entry screen**

Use `VITE_SHARED_PASSPHRASE` with local development fallback `2021121`. Store only the selected `PartnerId` in `sessionStorage`; never store the entered passphrase. Provide `partnerId`, `selectPartner`, and `signOut` from context. Display a clear note that the local passphrase is convenience protection rather than secure authentication.

- [ ] **Step 4: Run entry tests**

Run: `npm test -- src/features/session/EntryScreen.test.tsx`

Expected: PASS for wrong passphrase, identity selection, and sign-out.

- [ ] **Step 5: Commit session access**

```powershell
git add src/app src/features/session
git commit -m "feat: add private identity entry"
```

### Task 5: Add availability editing and the shared month calendar

**Files:**
- Create: `src/domain/availability.ts`
- Create: `src/domain/availability.test.ts`
- Create: `src/features/calendar/MonthCalendar.tsx`
- Create: `src/features/calendar/DayPanel.tsx`
- Create: `src/features/calendar/AvailabilityEditor.tsx`
- Create: `src/features/calendar/MonthCalendar.test.tsx`
- Create: `src/app/useBookingData.ts`

- [ ] **Step 1: Write failing availability tests**

```ts
it('normalizes duplicate periods and preserves a partner-specific record', () => {
  const value = createAvailability({
    ownerId: 'her', date: '2026-07-25', periods: ['evening', 'evening'], note: '下班后',
  });
  expect(value.periods).toEqual(['evening']);
  expect(value.ownerId).toBe('her');
});
```

```tsx
it('shows both partners availability on the selected day', async () => {
  render(<MonthCalendar initialMonth="2026-07" repository={seededRepository} partnerId="him" />);
  await userEvent.click(screen.getByRole('button', { name: /7月25日/ }));
  expect(screen.getByText('她：晚上')).toBeInTheDocument();
  expect(screen.getByText('他：下午')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain/availability.test.ts src/features/calendar/MonthCalendar.test.tsx`

Expected: FAIL because availability and calendar components are missing.

- [ ] **Step 3: Implement availability validation**

`createAvailability` must reject an empty period list, validate ISO date format `yyyy-MM-dd`, deduplicate periods, trim the note, and generate `id` as `${ownerId}:${date}` so later edits replace the same partner/day record.

- [ ] **Step 4: Implement calendar navigation and day details**

Use date-fns `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `addMonths`, `subMonths`, and `format`. Each date button needs an accessible Chinese label, visible today/selected states, and status dots for availability, pending invitations, and confirmed invitations.

- [ ] **Step 5: Implement availability editing**

The editor lets the current partner toggle `全天、上午、下午、晚上`, enter an optional note, save through the repository, and update the calendar immediately through `useBookingData`.

- [ ] **Step 6: Run calendar tests and full suite**

Run: `npm test`

Expected: all tests PASS, including both partners on one day and month navigation.

- [ ] **Step 7: Commit calendar and availability**

```powershell
git add src/domain/availability* src/features/calendar src/app/useBookingData.ts
git commit -m "feat: add shared availability calendar"
```

### Task 6: Build bidirectional invitation creation

**Files:**
- Create: `src/domain/createInvitation.ts`
- Create: `src/domain/createInvitation.test.ts`
- Create: `src/features/invitations/InvitationForm.tsx`
- Create: `src/features/invitations/InvitationForm.test.tsx`
- Create: `src/features/invitations/activityOptions.ts`
- Modify: `src/features/calendar/DayPanel.tsx`

- [ ] **Step 1: Write failing form and validation tests**

```ts
it('creates a pending invitation addressed to the other partner', () => {
  const invitation = createInvitation({
    senderId: 'him', date: '2026-07-25', period: 'evening', activity: '看电影', note: '看新上映的电影',
  }, '2026-07-18T10:00:00.000Z');
  expect(invitation.recipientId).toBe('her');
  expect(invitation.status).toBe('pending');
  expect(invitation.history[0].action).toBe('created');
});

it.each(['日期', '时段', '活动'])('shows a field error when %s is missing', async (field) => {
  render(<InvitationForm partnerId="him" onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '发送约会邀请' }));
  expect(screen.getByText(`${field}不能为空`)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain/createInvitation.test.ts src/features/invitations/InvitationForm.test.tsx`

Expected: FAIL because creation logic and form are missing.

- [ ] **Step 3: Add creation logic and activity choices**

Preset activities are `一起吃饭`, `看电影`, `散步聊天`, and `短途出游`. A fifth card, `自定义`, reveals a required text field. Trim activity and note, create the recipient as the opposite partner, and append a `created` history entry.

- [ ] **Step 4: Save the invitation and recipient notification atomically in the UI action**

On successful validation, construct the `created` notification for `invitation.recipientId` and call `repository.saveInvitationWithNotification(invitation, notification)`. If the write throws, keep the form values and show `保存失败，请重试`.

- [ ] **Step 5: Run invitation creation tests**

Run: `npm test -- src/domain/createInvitation.test.ts src/features/invitations/InvitationForm.test.tsx`

Expected: PASS for either sender identity, presets, custom activity, validation, and persistence errors.

- [ ] **Step 6: Commit invitation creation**

```powershell
git add src/domain/createInvitation* src/features/invitations src/features/calendar/DayPanel.tsx
git commit -m "feat: add bidirectional date invitations"
```

### Task 7: Add invitation details and response actions

**Files:**
- Create: `src/features/invitations/InvitationDetails.tsx`
- Create: `src/features/invitations/InvitationDetails.test.tsx`
- Create: `src/features/invitations/AdjustmentForm.tsx`
- Modify: `src/domain/invitations.ts`

- [ ] **Step 1: Write failing permissions and history UI tests**

```tsx
it('shows confirm, reject, and adjustment actions only to the recipient', () => {
  const invitation = invitationBuilder({ senderId: 'him', recipientId: 'her' });
  const { rerender } = render(<InvitationDetails invitation={invitation} partnerId="him" />);
  expect(screen.queryByRole('button', { name: '确认约会' })).not.toBeInTheDocument();
  rerender(<InvitationDetails invitation={invitation} partnerId="her" />);
  expect(screen.getByRole('button', { name: '确认约会' })).toBeInTheDocument();
});

it('requires confirmation before rejecting or cancelling', async () => {
  render(<InvitationDetails invitation={invitationBuilder()} partnerId="her" />);
  await userEvent.click(screen.getByRole('button', { name: '拒绝' }));
  expect(screen.getByRole('dialog', { name: '确认拒绝这个约会吗？' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/invitations/InvitationDetails.test.tsx`

Expected: FAIL because details and response controls are missing.

- [ ] **Step 3: Implement details, adjustment form, and state-specific actions**

Render proposal details and chronological history. Recipient actions on `pending` are confirm, reject, and suggest adjustment. Sender action is cancel. On `adjustment_pending`, show the latest proposed values and allow only the original sender to accept or cancel. Terminal states expose no mutation controls.

- [ ] **Step 4: Create a notification for every response**

Map actions to notification kinds: adjustment → `adjusted`, confirm or accepted adjustment → `confirmed`, reject → `rejected`, cancel → `cancelled`. Address the notification to the partner who did not perform the action and persist the updated invitation plus notification with `saveInvitationWithNotification`.

- [ ] **Step 5: Run invitation detail and domain tests**

Run: `npm test -- src/features/invitations/InvitationDetails.test.tsx src/domain/invitations.test.ts`

Expected: PASS for role permissions, all transitions, confirmation dialogs, preserved proposals, and notifications.

- [ ] **Step 6: Commit response actions**

```powershell
git add src/domain/invitations.ts src/features/invitations
git commit -m "feat: add invitation responses and adjustments"
```

### Task 8: Add grouped schedules and in-app notifications

**Files:**
- Create: `src/features/invitations/InvitationList.tsx`
- Create: `src/features/invitations/InvitationList.test.tsx`
- Create: `src/features/notifications/NotificationBell.tsx`
- Create: `src/features/notifications/NotificationList.tsx`
- Create: `src/features/notifications/notifications.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing grouping and unread tests**

```tsx
it('groups invitations by the current partner relationship to them', () => {
  render(<InvitationList partnerId="him" invitations={invitationSet} />);
  expect(screen.getByRole('heading', { name: '待我处理' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '我发起的' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '已确认' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '历史记录' })).toBeInTheDocument();
});

it('counts only unread notifications for the current partner', () => {
  render(<NotificationBell partnerId="her" notifications={notificationSet} />);
  expect(screen.getByLabelText('2 条未读提醒')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/invitations/InvitationList.test.tsx src/features/notifications/notifications.test.tsx`

Expected: FAIL because list and notification components are missing.

- [ ] **Step 3: Implement deterministic grouping and sorting**

`待我处理` contains pending invitations where current partner is recipient plus adjustment-pending invitations where current partner is the original sender. `我发起的` contains active invitations sent by the current partner. `已确认` contains upcoming confirmed invitations. `历史记录` contains rejected, cancelled, and confirmed invitations whose date is before today. Sort active groups ascending by date and history descending by `updatedAt`.

- [ ] **Step 4: Implement notification reading behavior**

The bell shows the current partner's unread count. Opening a notification navigates to its invitation and calls `markNotificationRead`; opening an invitation directly marks all unread notifications for that partner and invitation as read.

- [ ] **Step 5: Wire app routes**

Use routes `/`, `/invite`, `/invitations`, and `/invitations/:id`. Invalid invitation IDs render `没有找到这个约会` plus a button back to the shared calendar.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`

Expected: all unit and component tests PASS.

- [ ] **Step 7: Commit lists and notifications**

```powershell
git add src/app/App.tsx src/features/invitations src/features/notifications
git commit -m "feat: add schedules and in-app reminders"
```

### Task 9: Apply the responsive romantic visual system and accessibility rules

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/styles/components.css`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/AppShell.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing shell accessibility tests**

```tsx
it('provides keyboard-accessible primary navigation', async () => {
  render(<AppShell />);
  expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '我的安排' })).toHaveAttribute('href', '/invitations');
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/app/AppShell.test.tsx`

Expected: FAIL because the shell is missing.

- [ ] **Step 3: Define visual tokens and global rules**

Use cream `#FFF8F1`, surface `#FFFFFF`, coral `#E97865`, blush `#F7C8C2`, cocoa `#493936`, success `#3C8A68`, warning `#C7802D`, and error `#B44545`. Use system Chinese fonts, 16px base text, 44px minimum touch targets, visible `:focus-visible`, and `prefers-reduced-motion` to disable nonessential transitions.

- [ ] **Step 4: Build responsive shell and reusable component styles**

At widths below 720px use a sticky bottom navigation and full-width forms. At 720px and above use a centered `min(1120px, 100% - 48px)` container and top navigation. Status must always have a text label in addition to color.

- [ ] **Step 5: Run tests and manually inspect both breakpoints**

Run: `npm test && npm run dev`

Expected: tests PASS; at 390×844 and 1280×800 no horizontal scrolling occurs and all primary actions remain visible.

- [ ] **Step 6: Commit visual design**

```powershell
git add src/styles src/app/AppShell* src/main.tsx
git commit -m "style: add responsive romantic interface"
```

### Task 10: Add end-to-end coverage, recovery UI, and beginner documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/booking-flow.spec.ts`
- Create: `src/app/DataRecoveryScreen.tsx`
- Create: `src/app/DataRecoveryScreen.test.tsx`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write the failing two-person end-to-end scenario**

```ts
test('both partners can publish availability and complete an invitation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是他' }).click();
  await page.getByRole('button', { name: '发起约会' }).click();
  await page.getByLabel('日期').fill('2026-07-25');
  await page.getByLabel('晚上').check();
  await page.getByRole('button', { name: '看电影' }).click();
  await page.getByRole('button', { name: '发送约会邀请' }).click();
  await page.getByRole('button', { name: '切换身份' }).click();
  await page.getByRole('button', { name: '我是她' }).click();
  await page.getByLabel(/1 条未读提醒/).click();
  await page.getByRole('button', { name: '确认约会' }).click();
  await expect(page.getByText('已确认')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E and verify failure**

Run: `npx playwright install chromium && npm run e2e`

Expected: FAIL until routes, labels, identity switching, and confirmation work together.

- [ ] **Step 3: Add corrupt-data recovery tests and screen**

```tsx
it('lets the user reset only application data after a parse failure', async () => {
  localStorage.setItem('couple-date-booking', '{broken');
  render(<App />);
  expect(screen.getByRole('heading', { name: '本地数据无法读取' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '重置约会数据' }));
  expect(localStorage.getItem('couple-date-booking')).toBeNull();
});
```

The reset button opens a confirmation dialog, removes only `couple-date-booking`, and reloads the empty application after confirmation.

- [ ] **Step 4: Document local setup and usage**

`README.md` must contain exact commands `npm install`, `Copy-Item .env.example .env.local`, `npm run dev`, `npm test`, `npm run build`, and `npm run e2e`; explain the two identities, local-only data, browser-specific persistence, how to change the passphrase, and that email/cloud synchronization belong to a later phase.

`.env.example` contains:

```dotenv
VITE_SHARED_PASSPHRASE=2021121
```

- [ ] **Step 5: Run final verification**

Run: `npm test && npm run build && npm run e2e`

Expected: unit/component tests PASS, TypeScript build PASS, and the complete Chromium workflow PASS.

- [ ] **Step 6: Review production build locally**

Run: `npm run dev -- --host 127.0.0.1`

Expected: the entry, calendar, invitation, response, notifications, identity switching, persistence, invalid link, and data recovery flows work at phone and desktop widths.

- [ ] **Step 7: Commit the verified local first version**

```powershell
git add playwright.config.ts e2e src/app README.md .env.example
git commit -m "test: verify complete local booking flow"
```

## Deferred cloud phase contract

The local first version is complete without cloud services. A later plan may add a cloud repository implementing `DateBookingRepository`, secure per-partner authentication, real-time synchronization, deployment, and email delivery for the five notification kinds. No screen should import `localStorage` directly, so that phase remains an adapter and infrastructure change rather than an interface rewrite.
