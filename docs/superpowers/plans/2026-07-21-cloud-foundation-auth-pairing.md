# Cloud Foundation, Authentication, and Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared local passphrase and manual identity switcher with persistent Supabase email accounts and a secure two-person pairing flow.

**Architecture:** A single browser Supabase client restores Auth sessions. Database RPCs own couple creation, invite generation, and invite redemption so membership limits and identity assignment cannot be bypassed by the browser. Until the shared-data plan is complete, paired users see a deliberate cloud-setup screen instead of local test data.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Supabase Auth, PostgreSQL migrations, pgTAP, Playwright

---

## File Map

- Create `src/lib/supabaseConfig.ts`: validates public Vite configuration.
- Create `src/lib/supabaseClient.ts`: creates the one browser Supabase client.
- Create `src/lib/database.types.ts`: checked-in generated database types.
- Create `src/auth/authGateway.ts`: narrow Auth/RPC interface used by React and tests.
- Create `src/auth/supabaseAuthGateway.ts`: Supabase implementation.
- Create `src/features/session/AuthScreen.tsx`: sign-in and registration form.
- Create `src/features/session/PairingScreen.tsx`: create-space and join-by-code flows.
- Create `src/features/session/VerifyEmailScreen.tsx`: email verification state.
- Create `src/app/CloudSetupScreen.tsx`: temporary paired-state boundary.
- Modify `src/app/SessionProvider.tsx`: asynchronous Auth session state machine.
- Modify `src/app/App.tsx`: render loading/auth/verification/pairing/paired states.
- Modify `src/app/AppShell.tsx`: show profile name and real sign-out.
- Create `supabase/migrations/202607210001_auth_pairing.sql`: profiles, couples, members, invite RPCs, and RLS.
- Create `supabase/tests/auth_pairing.test.sql`: membership, invite, and permission tests.
- Create `.env.example`: public Supabase variable names only.

### Task 1: Install and Validate the Supabase Client

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `src/lib/supabaseConfig.ts`
- Create: `src/lib/supabaseConfig.test.ts`
- Create: `src/lib/supabaseClient.ts`

- [ ] **Step 1: Write the failing configuration tests**

```ts
import { readSupabaseConfig } from './supabaseConfig';

it('accepts the public project URL and publishable key', () => {
  expect(readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  })).toEqual({
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_example',
  });
});

it('rejects missing public configuration without printing secrets', () => {
  expect(() => readSupabaseConfig({})).toThrow('Supabase 连接信息尚未配置');
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npm test -- src/lib/supabaseConfig.test.ts`

Expected: FAIL because `src/lib/supabaseConfig.ts` does not exist.

- [ ] **Step 3: Install Supabase and implement configuration validation**

Run: `npm install @supabase/supabase-js && npm install -D supabase`

```ts
// src/lib/supabaseConfig.ts
interface PublicEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export function readSupabaseConfig(environment: PublicEnvironment) {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new Error('Supabase 连接信息尚未配置');
  return { url, publishableKey };
}
```

```ts
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readSupabaseConfig } from './supabaseConfig';

const config = readSupabaseConfig(import.meta.env);
export const supabase = createClient<Database>(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```

`.env.example` must contain only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Add `.env` and `.env.*` to `.gitignore`, followed by `!.env.example`. Never add the database password, `service_role`, or a secret key.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/lib/supabaseConfig.test.ts && npm run build`

Expected: 2 tests PASS and the production build succeeds.

```powershell
git add package.json package-lock.json .gitignore .env.example src/lib
git commit -m "build: add Supabase browser client"
```

### Task 2: Create the Pairing Database Migration

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607210001_auth_pairing.sql`
- Create: `src/lib/database.types.ts`

- [ ] **Step 1: Initialize local Supabase files**

Run: `npx supabase init`

Expected: `supabase/config.toml` exists. Do not run SQL in the hosted SQL Editor.

- [ ] **Step 2: Add schema and invariants in one versioned migration**

The migration must define these exact objects:

```sql
create extension if not exists pgcrypto;
create type public.partner_identity as enum ('him', 'her');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  identity public.partner_identity not null,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (couple_id, identity)
);

create table public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index one_active_invite_per_couple
  on public.couple_invites(couple_id) where used_at is null;
```

Add a `security definer` trigger on `auth.users` that inserts `profiles(id, display_name)` using `raw_user_meta_data->>'display_name'`, falling back to the email prefix. Set `search_path = public, extensions` on every definer function.

Add helper functions `public.current_couple_id()` and `public.is_couple_member(uuid)` and enable RLS on all four tables. Policies must allow a user to select only their profile, their couple, and members of their couple. No normal policy may select `couple_invites`.

Implement these exact RPC contracts:

```sql
public.create_couple_with_invite(p_identity public.partner_identity)
returns table (couple_id uuid, invite_code text, expires_at timestamptz)

public.regenerate_couple_invite()
returns table (invite_code text, expires_at timestamptz)

public.redeem_couple_invite(p_invite_code text)
returns table (couple_id uuid, identity public.partner_identity)
```

Each RPC must lock the relevant couple/invite rows, require `auth.uid()`, reject an existing membership, enforce at most two members, generate a 12-character uppercase code from cryptographic random bytes, store only `encode(digest(invite_code, 'sha256'), 'hex')`, expire it at `now() + interval '7 days'`, and mark it used in the same transaction that inserts the second member. Revoke direct table writes from `authenticated`; grant only `execute` on the three RPCs.

- [ ] **Step 3: Start local Supabase and apply the migration**

Run: `npx supabase start`

Run: `npx supabase db reset`

Expected: the migration completes without SQL errors. If Docker is not installed, stop here and install Docker Desktop before continuing; do not substitute the production SQL Editor.

- [ ] **Step 4: Generate checked-in database types**

Run: `npx supabase gen types typescript --local --schema public > src/lib/database.types.ts`

Expected: `Database` contains `profiles`, `couples`, `couple_members`, `couple_invites`, and the three RPC names.

- [ ] **Step 5: Commit**

```powershell
git add supabase src/lib/database.types.ts
git commit -m "feat: add secure couple pairing schema"
```

### Task 3: Prove Pairing and RLS Behavior

**Files:**
- Create: `supabase/tests/auth_pairing.test.sql`

- [ ] **Step 1: Write pgTAP tests before changing the migration**

Use `tests.create_supabase_user()` or explicit rows in `auth.users` to create users A, B, and C. Set request identity with:

```sql
select set_config('request.jwt.claim.sub', :'user_a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
```

The test file must assert all of the following with named pgTAP assertions:

```sql
select lives_ok($$ select * from public.create_couple_with_invite('him') $$,
  'first user creates a couple');
select is((select count(*) from public.couple_members where couple_id = :'couple_a')::int, 1,
  'creator becomes first member');
select throws_ok($$ select * from public.create_couple_with_invite('her') $$,
  'already paired', 'one user cannot create two couples');
select lives_ok(format('select * from public.redeem_couple_invite(%L)', :'invite_code'),
  'second user redeems invite');
select is((select count(*) from public.couple_members where couple_id = :'couple_a')::int, 2,
  'couple has exactly two members');
select throws_ok(format('select * from public.redeem_couple_invite(%L)', :'invite_code'),
  'invite unavailable', 'invite is single-use');
select is((select count(*) from public.couples)::int, 0,
  'outsider cannot select another couple');
select is((select count(*) from public.couple_invites)::int, 0,
  'invite rows are never directly readable');
```

Also test expired codes, regenerated-code invalidation, opposite identity assignment, third-user rejection, and concurrent redemption leaving exactly two members.

- [ ] **Step 2: Run the database tests and observe failures**

Run: `npx supabase test db`

Expected: at least one assertion fails until all migration policies and RPC guards are complete.

- [ ] **Step 3: Tighten the migration until every database test passes**

Do not weaken the tests. Use `FOR UPDATE` locks inside RPCs and keep `couple_invites` inaccessible through direct `select`.

- [ ] **Step 4: Verify and commit**

Run: `npx supabase db reset && npx supabase test db`

Expected: migration succeeds and all pgTAP assertions pass.

```powershell
git add supabase/migrations/202607210001_auth_pairing.sql supabase/tests/auth_pairing.test.sql
git commit -m "test: verify pairing and membership policies"
```

### Task 4: Add the Auth Gateway and Persistent Session State

**Files:**
- Create: `src/auth/authGateway.ts`
- Create: `src/auth/supabaseAuthGateway.ts`
- Create: `src/app/SessionProvider.test.tsx`
- Modify: `src/app/SessionProvider.tsx`

- [ ] **Step 1: Write state-machine tests with a fake gateway**

Cover: initial loading, signed out, unverified email, verified but unpaired, paired identity derived from `couple_members`, persistent sign-in, session-only sign-in, and sign-out.

```ts
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'verification_required'; email: string }
  | { status: 'unpaired'; userId: string; displayName: string }
  | { status: 'paired'; userId: string; displayName: string; coupleId: string; partnerId: PartnerId }
  | { status: 'error'; message: string };

export interface AuthSession {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export interface Membership {
  coupleId: string;
  userId: string;
  displayName: string;
  partnerId: PartnerId;
}

export interface PairingResult {
  coupleId: string;
  partnerId: PartnerId;
  inviteCode?: string;
  expiresAt?: string;
}
```

The test fake must expose `restoreSession`, `subscribe`, `signIn`, `signUp`, `signOut`, and `loadMembership`. Assert that `partnerId` always comes from membership data and no `selectPartner` method remains.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/app/SessionProvider.test.tsx`

Expected: FAIL because the new gateway and state types do not exist.

- [ ] **Step 3: Implement the gateway and provider**

```ts
// src/auth/authGateway.ts
export interface AuthGateway {
  restoreSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
  signIn(input: { email: string; password: string; persistent: boolean }): Promise<void>;
  signUp(input: { email: string; password: string; displayName: string }): Promise<'signed_in' | 'verification_required'>;
  signOut(): Promise<void>;
  loadMembership(userId: string): Promise<Membership | null>;
  createCouple(identity: PartnerId): Promise<PairingResult>;
  redeemInvite(code: string): Promise<PairingResult>;
  regenerateInvite(): Promise<{ inviteCode: string; expiresAt: string }>;
}
```

Create a `BrowserAuthStorage` adapter implementing Supabase's `SupportedStorage`. Its `getItem` checks `sessionStorage` first and then `localStorage`; `setItem` writes to the selected store and removes the same key from the other store; `removeItem` clears both. Before `signInWithPassword`, call `storage.setPersistent(input.persistent)`. This makes the checked default use `localStorage` and the unchecked option use `sessionStorage` without maintaining two Supabase clients. Normalize Auth errors to stable Chinese messages without exposing raw database details.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/app/SessionProvider.test.tsx`

Expected: all session-state tests PASS.

```powershell
git add src/auth src/app/SessionProvider.tsx src/app/SessionProvider.test.tsx
git commit -m "feat: restore persistent Supabase sessions"
```

### Task 5: Build Registration, Login, and Pairing Screens

**Files:**
- Create: `src/features/session/AuthScreen.tsx`
- Create: `src/features/session/AuthScreen.test.tsx`
- Create: `src/features/session/PairingScreen.tsx`
- Create: `src/features/session/PairingScreen.test.tsx`
- Create: `src/features/session/VerifyEmailScreen.tsx`
- Create: `src/app/CloudSetupScreen.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/styles/components.css`
- Delete: `src/features/session/EntryScreen.tsx`
- Delete: `src/features/session/EntryScreen.test.tsx`

- [ ] **Step 1: Write failing component tests**

Test exact user-visible behavior:

```tsx
expect(screen.getByRole('tab', { name: '登录' })).toHaveAttribute('aria-selected', 'true');
expect(screen.getByLabelText('保持登录')).toBeChecked();
expect(screen.getByRole('button', { name: '创建我们的空间' })).toBeEnabled();
expect(screen.getByRole('button', { name: '加入对方的空间' })).toBeEnabled();
```

Submit errors must preserve email, display name, invite code, and selected identity. A successful create must display the returned code exactly once with its expiry. A successful redeem must transition to `paired` and must not show an identity switcher.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/session`

Expected: FAIL because the new screens do not exist.

- [ ] **Step 3: Implement the screens and route the session states**

`AppContent` must be exhaustive:

```tsx
switch (session.status) {
  case 'loading': return <main className="session-state"><p>正在恢复登录...</p></main>;
  case 'signed_out': return <AuthScreen />;
  case 'verification_required': return <VerifyEmailScreen email={session.email} />;
  case 'unpaired': return <PairingScreen />;
  case 'paired': return <CloudSetupScreen onSignOut={signOut} />;
  case 'error': return <main role="alert">{session.message}</main>;
}
```

The UI uses email and password fields with browser autocomplete, a checked-by-default “保持登录” checkbox, visible submit/loading/error states, and two equal-size identity choices during couple creation only. Remove the passphrase `2021121`, `sessionStorage` partner selection, and “切换身份”.

- [ ] **Step 4: Run tests, build, and commit**

Run: `npm test && npm run build`

Expected: all component/unit tests pass; old local-entry tests have been replaced; build succeeds.

```powershell
git add src
git commit -m "feat: add account and couple pairing screens"
```

### Task 6: Link the Hosted Project and Verify Two Accounts

**Files:**
- Create: `docs/supabase-setup.md`
- Modify: `README.md`
- Modify: `e2e/booking-flow.spec.ts`

- [ ] **Step 1: Add a local-only environment file**

Create `.env.local` from `.env.example` and enter only:

```dotenv
VITE_SUPABASE_URL=https://agakrexkrsqjxqsotzxd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key copied from Supabase Connect>
```

Confirm with `git status --short` that `.env.local` is ignored.

- [ ] **Step 2: Link and push the reviewed migrations**

Run: `npx supabase login`

Run: `npx supabase link --project-ref agakrexkrsqjxqsotzxd`

Run: `npx supabase db push --dry-run`

Expected: only `202607210001_auth_pairing.sql` is listed.

Run: `npx supabase db push`

Expected: the hosted project records the migration successfully. This is the first point at which hosted database state changes.

- [ ] **Step 3: Configure Auth deliberately**

In Supabase Dashboard, keep email confirmation enabled. Set Site URL to `http://127.0.0.1:5173` for local acceptance and add both `http://127.0.0.1:5173/**` and `http://localhost:5173/**` to Redirect URLs. Record these exact values in `docs/supabase-setup.md`.

- [ ] **Step 4: Replace local-only E2E with an opt-in cloud pairing test**

Keep unit/component tests using a fake gateway. Add a Playwright test guarded by `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, and `E2E_USER_B_PASSWORD`; if absent, call `test.skip`. The flow registers or signs in A, creates a space, captures the invite, signs in B in a second browser context, redeems the invite, reloads both contexts, and verifies identities persist.

- [ ] **Step 5: Final verification and commit**

Run: `npm test && npm run build && npm run e2e`

Expected: unit/component tests pass, build succeeds, local E2E tests pass, and cloud E2E is either explicitly skipped without credentials or passes with both test accounts.

```powershell
git add README.md docs/supabase-setup.md e2e/booking-flow.spec.ts
git commit -m "docs: document Supabase account setup"
```

## Phase Acceptance

- Two verified email accounts can sign in independently.
- Closing and reopening the browser restores a persistent session.
- Disabling “保持登录” limits the session to that browser session.
- User A creates one couple and receives a 7-day, one-use code.
- User B redeems it and receives the opposite identity.
- User C, expired codes, reused codes, and regenerated old codes are rejected.
- No user can choose or switch identity after pairing.
- No local test bookings or photos are imported.
