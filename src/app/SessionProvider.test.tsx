import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FakeAuthGateway } from '../test/fakeAuthGateway';
import { SessionProvider, useSession } from './SessionProvider';

function wrapperFor(gateway: FakeAuthGateway) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SessionProvider authGateway={gateway}>{children}</SessionProvider>;
  };
}

it('restores a signed-out session after loading', async () => {
  const gateway = new FakeAuthGateway();
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  expect(result.current.state).toEqual({ status: 'loading' });
  await waitFor(() => expect(result.current.state).toEqual({ status: 'signed_out' }));
});

it('finishes loading when subscribe emits the restored session synchronously', async () => {
  const session = { userId: 'user-a', email: 'a@example.com', emailVerified: true };
  const gateway = new FakeAuthGateway({
    session,
    accountContext: { displayName: '小雨', membership: null },
  });
  gateway.subscribe = (listener) => {
    listener(session);
    return () => undefined;
  };

  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  await waitFor(() => expect(result.current.state.status).toBe('unpaired'));
  expect(gateway.loadAccountContextCalls).toEqual(['user-a']);
});

it('requires verification for an unverified account', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'user-a', email: 'a@example.com', emailVerified: false },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  await waitFor(() =>
    expect(result.current.state).toEqual({
      status: 'verification_required',
      email: 'a@example.com',
    }),
  );
});

it('loads a verified unpaired profile', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'user-a', email: 'a@example.com', emailVerified: true },
    accountContext: { displayName: '小雨', membership: null },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  await waitFor(() =>
    expect(result.current.state).toEqual({
      status: 'unpaired',
      userId: 'user-a',
      displayName: '小雨',
    }),
  );
});

it('derives paired identity and member count only from membership', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'user-a', email: 'a@example.com', emailVerified: true },
    accountContext: {
      displayName: '小雨',
      membership: { coupleId: 'couple-1', partnerId: 'her', memberCount: 2 },
    },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  await waitFor(() =>
    expect(result.current.state).toEqual({
      status: 'paired',
      userId: 'user-a',
      displayName: '小雨',
      coupleId: 'couple-1',
      partnerId: 'her',
      memberCount: 2,
    }),
  );
});

it.each([true, false])('passes persistent=%s through sign in', async (persistent) => {
  const gateway = new FakeAuthGateway();
  gateway.accountContext = { displayName: '小雨', membership: null };
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });
  await waitFor(() => expect(result.current.state.status).toBe('signed_out'));
  gateway.setSession({ userId: 'user-a', email: 'a@example.com', emailVerified: true });

  await act(() =>
    result.current.signIn({ email: 'a@example.com', password: 'secret123', persistent }),
  );

  expect(gateway.signInCalls).toEqual([
    { email: 'a@example.com', password: 'secret123', persistent },
  ]);
});

it('updates when the auth subscription emits a new session', async () => {
  const gateway = new FakeAuthGateway();
  gateway.accountContext = { displayName: '小雨', membership: null };
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });
  await waitFor(() => expect(result.current.state.status).toBe('signed_out'));

  act(() =>
    gateway.emit({ userId: 'user-a', email: 'a@example.com', emailVerified: true }),
  );

  await waitFor(() => expect(result.current.state.status).toBe('unpaired'));
});

it('ignores a duplicate auth event for the same verified account', async () => {
  const session = { userId: 'user-a', email: 'a@example.com', emailVerified: true };
  const gateway = new FakeAuthGateway({
    session,
    accountContext: { displayName: '小雨', membership: null },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });
  await waitFor(() => expect(result.current.state.status).toBe('unpaired'));
  expect(gateway.loadAccountContextCalls).toEqual(['user-a']);

  act(() => gateway.emit({ ...session }));

  expect(result.current.state.status).toBe('unpaired');
  expect(gateway.loadAccountContextCalls).toEqual(['user-a']);
});

it('processes email verification changes for the same account', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'user-a', email: 'a@example.com', emailVerified: false },
    accountContext: { displayName: '小雨', membership: null },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });
  await waitFor(() => expect(result.current.state.status).toBe('verification_required'));

  act(() => gateway.emit({ userId: 'user-a', email: 'a@example.com', emailVerified: true }));

  await waitFor(() => expect(result.current.state.status).toBe('unpaired'));
  expect(gateway.loadAccountContextCalls).toEqual(['user-a']);
});

it('signs out and clears the state', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'user-a', email: 'a@example.com', emailVerified: true },
    accountContext: { displayName: '小雨', membership: null },
  });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });
  await waitFor(() => expect(result.current.state.status).toBe('unpaired'));

  await act(() => result.current.signOut());

  expect(gateway.signOutCalls).toBe(1);
  expect(result.current.state).toEqual({ status: 'signed_out' });
});

it('shows a stable error state when restoration fails', async () => {
  const gateway = new FakeAuthGateway();
  gateway.restoreError = new Error('连接失败，请稍后再试');
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  await waitFor(() =>
    expect(result.current.state).toEqual({ status: 'error', message: '连接失败，请稍后再试' }),
  );
});

it('does not let an expired account-context request overwrite a newer session', async () => {
  let resolveOld!: (value: { displayName: string; membership: null }) => void;
  const oldContext = new Promise<{ displayName: string; membership: null }>((resolve) => {
    resolveOld = resolve;
  });
  const gateway = new FakeAuthGateway({
    session: { userId: 'old', email: 'old@example.com', emailVerified: true },
  });
  gateway.loadContext = (userId) =>
    userId === 'old'
      ? oldContext
      : Promise.resolve({ displayName: '新会话', membership: null });
  const { result } = renderHook(useSession, { wrapper: wrapperFor(gateway) });

  act(() =>
    gateway.emit({ userId: 'new', email: 'new@example.com', emailVerified: true }),
  );
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ status: 'unpaired', userId: 'new' }),
  );

  await act(async () => resolveOld({ displayName: '旧会话', membership: null }));
  expect(result.current.state).toMatchObject({ status: 'unpaired', userId: 'new' });
});
