import type {
  AccountContext,
  AuthGateway,
  AuthSession,
  InviteResult,
  PairingResult,
  SignInInput,
  SignUpInput,
} from '../auth/authGateway';
import type { PartnerId } from '../domain/models';

interface FakeOptions {
  session?: AuthSession | null;
  accountContext?: AccountContext;
}

export class FakeAuthGateway implements AuthGateway {
  private session: AuthSession | null;
  private listeners = new Set<(session: AuthSession | null) => void>();
  accountContext: AccountContext;
  restoreError: Error | null = null;
  signInCalls: SignInInput[] = [];
  signOutCalls = 0;
  loadAccountContextCalls: string[] = [];
  loadContext?: (userId: string) => Promise<AccountContext>;

  constructor(options: FakeOptions = {}) {
    this.session = options.session ?? null;
    this.accountContext = options.accountContext ?? { displayName: '测试用户', membership: null };
  }

  setSession(session: AuthSession | null) {
    this.session = session;
  }

  emit(session: AuthSession | null) {
    this.session = session;
    this.listeners.forEach((listener) => listener(session));
  }

  async restoreSession() {
    if (this.restoreError) throw this.restoreError;
    return this.session;
  }

  subscribe(listener: (session: AuthSession | null) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async signIn(input: SignInInput) {
    this.signInCalls.push(input);
  }

  async signUp(_input: SignUpInput) {
    return 'verification_required' as const;
  }

  async signOut() {
    this.signOutCalls += 1;
    this.session = null;
  }

  async loadAccountContext(userId: string) {
    this.loadAccountContextCalls.push(userId);
    return this.loadContext ? this.loadContext(userId) : this.accountContext;
  }

  async createCouple(identity: PartnerId): Promise<PairingResult> {
    return { coupleId: 'couple-1', partnerId: identity, inviteCode: 'CODE12345678', expiresAt: new Date().toISOString() };
  }

  async redeemInvite(_code: string): Promise<PairingResult> {
    return { coupleId: 'couple-1', partnerId: 'her' };
  }

  async regenerateInvite(): Promise<InviteResult> {
    return { inviteCode: 'NEWCODE12345', expiresAt: new Date().toISOString() };
  }
}
