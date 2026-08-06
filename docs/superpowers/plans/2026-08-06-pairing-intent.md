# Pairing Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make invitation redemption choose a new couple or an old couple only after both account IDs are known.

**Architecture:** Add a pending invite table whose rows contain the creator and a hashed one-time code but no couple ID. Redemption finds a historical couple containing both users; it restores that couple when found, otherwise creates a new empty couple. The React pairing screen displays a pending invite without pretending the creator is already paired.

**Tech Stack:** Supabase Postgres/PLpgSQL, Supabase JS RPC gateway, React, Vitest, pgTAP.

---

### Task 1: Add database regression coverage

**Files:**
- Modify: `supabase/tests/auth_pairing.test.sql`

- [ ] Add a test fixture for two accounts with separate old couples and assert that redeeming a new invite creates a third couple containing exactly the inviter and redeemer.
- [ ] Add a test fixture for two accounts sharing an ended couple and assert that redeeming a new invite restores that exact couple instead of creating another one.
- [ ] Run the database test command used by the repository and confirm the new assertions fail against the old functions.

### Task 2: Implement pending invite RPCs

**Files:**
- Create: `supabase/migrations/202608060001_pairing_intents.sql`

- [ ] Create `public.pairing_invites` with creator, `code_hash`, expiry, used/revoked timestamps, and one active invite per creator; do not store plaintext codes or a `couple_id`.
- [ ] Add `create_pairing_invite(p_identity)` that requires an authenticated profile with no active membership, revokes the creator's prior pending invites, and returns a 12-character code.
- [ ] Add `redeem_pairing_invite(p_invite_code)` that locks the invite and both user keys, finds a historical couple containing both users, restores it when present, otherwise creates a new couple with the two users, and consumes the invite atomically.
- [ ] Add `regenerate_pairing_invite()` for an active one-member couple only, preserving compatibility for existing waiting spaces by creating a pending invite for that member and returning a code.
- [ ] Revoke old unused `couple_invites` records and grant only authenticated execute permissions for the new functions.

### Task 3: Update typed client and pairing UI

**Files:**
- Modify: `src/auth/authGateway.ts`
- Modify: `src/auth/supabaseAuthGateway.ts`
- Modify: `src/app/SessionProvider.tsx`
- Modify: `src/features/session/PairingScreen.tsx`
- Modify: `src/test/fakeAuthGateway.ts`
- Modify: `src/features/session/PairingScreen.test.tsx`

- [ ] Replace creation's `PairingResult` dependency with `InviteResult` while retaining `PairingResult` for redemption.
- [ ] Call `create_pairing_invite` when the user selects an identity and call `redeem_pairing_invite` for joining.
- [ ] Keep the displayed invite in local component state, show that it is waiting for the other account, and do not call `reload` as though a space already exists.
- [ ] Update fakes and tests so new-space creation and old-space restoration use the same public gateway contract.

### Task 4: Verify locally

**Files:**
- Modify: `src/lib/database.types.ts` if generated function types need updating.

- [ ] Run the focused pairing tests and confirm they pass.
- [ ] Run `npm test` and `npm run build`.
- [ ] Run `git diff --check` and inspect the migration for plaintext-code or service-role-key mistakes.

### Task 5: Release and live verification

**Files:**
- No additional source files.

- [ ] Push the database migration with `npx supabase db push` and verify `npx supabase migration list --linked` shows the new migration remotely.
- [ ] Commit and push the implementation to GitHub; confirm Vercel builds the pushed branch.
- [ ] Verify two fresh accounts create a new couple and two accounts with a shared ended couple restore that couple; verify a third historical account is rejected.
