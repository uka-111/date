import { BrowserAuthStorage } from './browserAuthStorage';
import { createSupabaseAuthGateway } from './supabaseAuthGateway';

function mockClient() {
  const listeners: Array<(event: string, session: unknown) => void> = [];
  const client = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((listener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  };
  return { client, listeners };
}

it('maps restored and subscribed Supabase users to auth sessions', async () => {
  const { client, listeners } = mockClient();
  client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@example.com', email_confirmed_at: 'now' } } }, error: null });
  const gateway = createSupabaseAuthGateway(client as never, new BrowserAuthStorage());

  await expect(gateway.restoreSession()).resolves.toEqual({ userId: 'u1', email: 'a@example.com', emailVerified: true });
  const listener = vi.fn();
  gateway.subscribe(listener);
  listeners[0]('SIGNED_IN', { user: { id: 'u2', email: 'b@example.com', confirmed_at: null } });
  expect(listener).toHaveBeenCalledWith({ userId: 'u2', email: 'b@example.com', emailVerified: false });
});

it('selects browser persistence before password sign-in', async () => {
  const { client } = mockClient();
  client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  const storage = new BrowserAuthStorage();
  const persistence = vi.spyOn(storage, 'setPersistent');
  const gateway = createSupabaseAuthGateway(client as never, storage);

  await gateway.signIn({ email: ' a@example.com ', password: 'secret', persistent: false });

  expect(persistence).toHaveBeenCalledWith(false);
  expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.com', password: 'secret' });
});

it('sends display_name metadata and reports email verification', async () => {
  const { client } = mockClient();
  client.auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
  const gateway = createSupabaseAuthGateway(client as never, new BrowserAuthStorage());

  await expect(gateway.signUp({ email: 'a@example.com', password: 'secret123', displayName: ' 小雨 ' })).resolves.toBe('verification_required');
  expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'a@example.com', password: 'secret123', options: { data: { display_name: '小雨' } } });
});

it('loads profile, membership and member count from database data', async () => {
  const { client } = mockClient();
  const profileSingle = vi.fn().mockResolvedValue({ data: { display_name: '小雨' }, error: null });
  const membershipSingle = vi.fn().mockResolvedValue({ data: { couple_id: 'c1', identity: 'her' }, error: null });
  const countEq = vi.fn().mockResolvedValue({ count: 2, error: null });
  client.from.mockImplementation((table) => {
    if (table === 'profiles') return { select: () => ({ eq: () => ({ single: profileSingle }) }) };
    if (table === 'couple_members') {
      const call = client.from.mock.calls.filter(([name]) => name === 'couple_members').length;
      if (call === 1) return { select: () => ({ eq: () => ({ is: () => ({ maybeSingle: membershipSingle }) }) }) };
      return { select: () => ({ eq: () => ({ is: countEq }) }) };
    }
    throw new Error('unexpected table');
  });
  const gateway = createSupabaseAuthGateway(client as never, new BrowserAuthStorage());

  await expect(gateway.loadAccountContext('u1')).resolves.toEqual({
    displayName: '小雨', membership: { coupleId: 'c1', partnerId: 'her', memberCount: 2 },
  });
});

it('maps RPC snake_case results and stable invite errors', async () => {
  const { client } = mockClient();
  client.rpc
    .mockResolvedValueOnce({ data: [{ couple_id: 'c1', invite_code: 'CODE12345678', expires_at: 'later' }], error: null })
    .mockResolvedValueOnce({ data: null, error: { message: 'invite unavailable: hidden SQL detail' } });
  const gateway = createSupabaseAuthGateway(client as never, new BrowserAuthStorage());

  await expect(gateway.createCouple('him')).resolves.toEqual({ coupleId: 'c1', partnerId: 'him', inviteCode: 'CODE12345678', expiresAt: 'later' });
  await expect(gateway.redeemInvite('BAD')).rejects.toThrow('邀请码不可用或已失效');
});

it('calls the leave-current-couple RPC', async () => {
  const { client } = mockClient();
  client.rpc.mockResolvedValue({ data: null, error: null });
  const gateway = createSupabaseAuthGateway(client as never, new BrowserAuthStorage());

  await gateway.leaveCurrentCouple();

  expect(client.rpc).toHaveBeenCalledWith('leave_current_couple');
});
