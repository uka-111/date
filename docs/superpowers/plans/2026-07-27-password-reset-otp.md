# Password Reset OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password-reset links with a Supabase recovery OTP flow that lets users enter a six-digit email code and then set a new password in the app.

**Architecture:** Keep Supabase Auth as the only recovery authority. `AuthGateway` will expose request-and-verify recovery operations; `SessionProvider` will hold the temporary recovery email and route the UI through email, OTP verification, and password update states. The Supabase email template will render `{{ .Token }}` instead of a redirect link.

**Tech Stack:** React, TypeScript, Vite, Supabase Auth, Vitest, Testing Library.

---

### Task 1: Extend the auth gateway for recovery OTP

**Files:**
- Modify: `src/auth/authGateway.ts`
- Modify: `src/auth/supabaseAuthGateway.ts`
- Modify: `src/test/fakeAuthGateway.ts`
- Test: `src/auth/supabaseAuthGateway.test.ts`

- [ ] **Step 1: Write failing gateway tests**

Add tests that assert `requestPasswordReset(email)` calls `resetPasswordForEmail` without a redirect requirement, and `verifyPasswordResetCode(email, token)` calls `verifyOtp({ email, token, type: 'recovery' })`.

- [ ] **Step 2: Run the focused tests and confirm the expected failure**

Run: `npm test -- src/auth/supabaseAuthGateway.test.ts`

Expected: FAIL because the gateway interface and implementation do not yet expose the OTP verification method.

- [ ] **Step 3: Implement the minimal gateway API**

Change the interface to:

```ts
requestPasswordReset(email: string): Promise<void>;
verifyPasswordResetCode(email: string, token: string): Promise<void>;
```

Implement the Supabase calls:

```ts
async requestPasswordReset(email: string) {
  const { error } = await client.auth.resetPasswordForEmail(email.trim());
  if (error) throw stableError(error);
}

async verifyPasswordResetCode(email: string, token: string) {
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error) throw stableError(error);
}
```

Add no-op implementations and call tracking to `FakeAuthGateway`.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npm test -- src/auth/supabaseAuthGateway.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the gateway change**

```bash
git add src/auth/authGateway.ts src/auth/supabaseAuthGateway.ts src/auth/supabaseAuthGateway.test.ts src/test/fakeAuthGateway.ts
git commit -m "feat: add password recovery otp gateway"
```

### Task 2: Add the email, OTP, and new-password UI flow

**Files:**
- Modify: `src/app/SessionProvider.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/session/AuthScreen.tsx`
- Create: `src/features/session/PasswordResetCodeScreen.tsx`
- Modify: `src/features/session/PasswordResetScreen.tsx`
- Test: `src/features/session/AuthScreen.test.tsx`
- Create: `src/features/session/PasswordResetCodeScreen.test.tsx`
- Test: `src/features/session/PasswordResetScreen.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover these behaviors:

```tsx
it('shows the code screen after a reset email is requested', async () => {
  // submit email, expect the six-digit code input and verify button
});

it('returns an expired or invalid code error without showing the password form', async () => {
  // reject verifyPasswordResetCode, expect role=alert
});

it('shows the password form after code verification succeeds', async () => {
  // resolve verification, expect new password fields
});
```

- [ ] **Step 2: Run the focused UI tests and confirm they fail for the missing flow**

Run: `npm test -- src/features/session/AuthScreen.test.tsx src/features/session/PasswordResetScreen.test.tsx src/features/session/PasswordResetCodeScreen.test.tsx`

Expected: FAIL because the app currently only has the email form and recovery-link state.

- [ ] **Step 3: Implement explicit recovery states**

Add a `password_reset_code` session state carrying the email, plus `requestPasswordReset(email)` that sets that state after sending and `verifyPasswordResetCode(token)` that transitions to `password_recovery` after the gateway succeeds. Keep `password_recovery` responsible for rendering `PasswordResetScreen`.

Add `PasswordResetCodeScreen` with:

- exactly six numeric characters (`inputMode="numeric"`, `maxLength={6}`);
- verify and resend actions;
- invalid/expired code error display;
- a return-to-login action.

Update `AuthScreen` copy from “发送重置邮件” to “发送验证码”. Pass the recovery email and verification callbacks through `App.tsx`.

- [ ] **Step 4: Run focused UI tests and confirm they pass**

Run: `npm test -- src/features/session/AuthScreen.test.tsx src/features/session/PasswordResetScreen.test.tsx src/features/session/PasswordResetCodeScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the UI flow**

```bash
git add src/app/SessionProvider.tsx src/app/App.tsx src/features/session/AuthScreen.tsx src/features/session/PasswordResetCodeScreen.tsx src/features/session/PasswordResetCodeScreen.test.tsx src/features/session/PasswordResetScreen.tsx src/features/session/AuthScreen.test.tsx src/features/session/PasswordResetScreen.test.tsx
git commit -m "feat: add password reset code screen"
```

### Task 3: Configure Supabase email template and validate the full flow

**Files:**
- No repository file change for the dashboard template; configure Supabase Auth email template.
- Test: full existing suite and production build.

- [ ] **Step 1: Update the Supabase reset-password email template**

In Supabase Dashboard → Authentication → Email Templates → Reset Password, replace the link-focused body with text containing:

```text
你的密码重置验证码是：{{ .Token }}
```

Keep the recipient email and expiry notice. Save the template.

- [ ] **Step 2: Run all tests and the production build**

Run:

```bash
npm test -- --run
npm run build
```

Expected: all test files pass and Vite exits with code 0.

- [ ] **Step 3: Verify on the deployed site**

Use `https://quietly-kept-days.vercel.app/` to request a reset, confirm the email contains a six-digit code, enter it, set a new password, and sign in with the new password. Also verify invalid, expired, and resend cases.

- [ ] **Step 4: Commit any final test-only adjustments and push the branch**

```bash
git push origin codex/settings-profile
```

Then wait for Vercel checks to become green before merging.
