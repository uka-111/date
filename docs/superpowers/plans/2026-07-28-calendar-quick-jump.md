# Calendar Quick Jump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expandable quick-jump panel for month, year, and five-year calendar views.

**Architecture:** Keep navigation state in `CalendarWorkspace`, where the current anchor and scale already live. Add a focused `CalendarQuickJump` component that renders native year/month selects according to the active scale and reports a target date plus close state through callbacks. Existing arrow navigation, view preference persistence, and booking data remain unchanged.

**Tech Stack:** React, TypeScript, date-fns, Vitest, Testing Library, Vite.

---

### Task 1: Add the failing quick-jump component tests

**Files:**
- Create: `src/features/calendar/CalendarQuickJump.test.tsx`

- [ ] **Step 1: Write tests for each scale.**

```tsx
it('shows year and month selectors for month view and reports the selected month', async () => {
  const onChange = vi.fn();
  render(<CalendarQuickJump scale="month" anchor={new Date(2026, 6, 1)} open onChange={onChange} />);
  await userEvent.selectOptions(screen.getByLabelText('年份'), '2027');
  await userEvent.selectOptions(screen.getByLabelText('月份'), '2');
  expect(onChange).toHaveBeenLastCalledWith(new Date(2027, 1, 1));
});

it('shows only a year selector for year view', () => {
  render(<CalendarQuickJump scale="year" anchor={new Date(2026, 6, 1)} open onChange={vi.fn()} />);
  expect(screen.getByLabelText('年份')).toBeInTheDocument();
  expect(screen.queryByLabelText('月份')).not.toBeInTheDocument();
});

it('shows five-year start year for five-year view', async () => {
  const onChange = vi.fn();
  render(<CalendarQuickJump scale="five_years" anchor={new Date(2026, 6, 1)} open onChange={onChange} />);
  await userEvent.selectOptions(screen.getByLabelText('五年区间起始年份'), '2030');
  expect(onChange).toHaveBeenCalledWith(new Date(2030, 0, 1));
});
```

- [ ] **Step 2: Run the focused test and confirm the feature is missing.**

Run: `npm test -- src/features/calendar/CalendarQuickJump.test.tsx`

Expected: FAIL because `CalendarQuickJump` does not exist.

### Task 2: Implement the minimal quick-jump component

**Files:**
- Create: `src/features/calendar/CalendarQuickJump.tsx`

- [ ] **Step 1: Add stable year options and native selects.**

Use the anchor year as the center of a 21-year range (`anchor year - 10` through `anchor year + 10`). For month view, keep year and month in local component state and call `onChange(new Date(year, month - 1, 1))` when either changes. For year and five-year views, call `onChange` with January 1 of the selected year. Render nothing when `open` is false.

- [ ] **Step 2: Run the focused tests.**

Run: `npm test -- src/features/calendar/CalendarQuickJump.test.tsx`

Expected: PASS.

### Task 3: Integrate the panel into the calendar workspace

**Files:**
- Modify: `src/features/calendar/CalendarWorkspace.tsx`
- Modify: `src/features/calendar/MonthCalendar.tsx`
- Modify: `src/styles/components.css`
- Test: `src/features/calendar/CalendarWorkspace.test.tsx`

- [ ] **Step 1: Add workspace integration tests before implementation.**

Render the workspace with a local repository and assert that clicking the month heading opens the panel, changing the year to `2027` and month to `2` changes the heading to `2027年2月`, and the panel is closed after the selection. Repeat the year and five-year headings with their corresponding selectors.

- [ ] **Step 2: Run the integration tests and confirm they fail.**

Run: `npm test -- src/features/calendar/CalendarWorkspace.test.tsx`

Expected: FAIL because the workspace has no quick-jump button or panel.

- [ ] **Step 3: Add the shared panel to `CalendarWorkspace`.**

Add `quickJumpOpen` state and a `setAnchorFromQuickJump` handler. For year and five-year headers, make the heading a button with `aria-expanded` and render `CalendarQuickJump` below the header. Pass `scale`, `anchor`, `open`, and the target callback. Close the panel after changing the anchor. Preserve the existing arrow buttons and `changeScale` behavior.

- [ ] **Step 4: Add the same heading trigger to `MonthCalendar`.**

Accept `onQuickJump?: () => void` and `quickJumpOpen?: boolean` props. Render the current month heading as a button with `aria-expanded` when the workspace supplies the callback. The actual panel remains owned by `CalendarWorkspace`, so month navigation still stays local to `MonthCalendar` while quick jumps update the workspace anchor.

- [ ] **Step 5: Add compact responsive styles.**

Style `.calendar-quick-jump` as a full-width, light surface directly under the header, with two equal-width controls on mobile and a single control for year/five-year views. Keep labels visible and prevent overflow at the existing mobile breakpoint.

- [ ] **Step 6: Run all calendar tests.**

Run: `npm test -- src/features/calendar`

Expected: PASS with no console errors.

### Task 4: Verify the complete application

**Files:**
- No additional source files.

- [ ] **Step 1: Run the full test suite.**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run the production build.**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Verify the rendered mobile flow.**

Start the existing dev server command from `package.json`, open the calendar route at a mobile viewport, click the month heading, select a year and month, and verify the heading updates and the panel closes. Repeat the year and five-year views. Check page identity, nonblank content, no framework overlay, console errors, and screenshot evidence.

- [ ] **Step 4: Review the diff and commit the implementation.**

Run: `git diff --check; git status --short`

Commit: `git add src/features/calendar src/styles/components.css docs/superpowers/plans/2026-07-28-calendar-quick-jump.md && git commit -m "feat: 增加日历快速定位"`
