import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthGateway,
  AuthEvent,
  AuthSession,
  InviteResult,
  PairingResult,
  SignInInput,
  SignUpInput,
  SignUpResult,
} from '../auth/authGateway';
import { createDefaultAuthGateway } from '../auth/supabaseAuthGateway';
import type { PartnerId } from '../domain/models';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'verification_required'; email: string }
  | { status: 'password_recovery'; userId: string }
  | { status: 'unpaired'; userId: string; displayName: string }
  | { status: 'paired'; userId: string; email: string; displayName: string; coupleId: string; partnerId: PartnerId; memberCount: number }
  | { status: 'error'; message: string };

interface SessionValue {
  state: SessionState;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
  createPairingInvite(identity: PartnerId): Promise<InviteResult>;
  redeemInvite(code: string): Promise<PairingResult>;
  regenerateInvite(): Promise<InviteResult>;
  leaveCurrentCouple(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateDisplayName(displayName: string): Promise<string>;
  updateEmail(email: string): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后再试';
}

function sameSession(
  current: AuthSession | null | undefined,
  next: AuthSession | null,
) {
  if (current === undefined) return false;
  if (current === null || next === null) return current === next;
  return current.userId === next.userId
    && current.email === next.email
    && current.emailVerified === next.emailVerified;
}

export function SessionProvider({
  children,
  authGateway,
}: {
  children: ReactNode;
  authGateway?: AuthGateway;
}) {
  const gatewayResult = useMemo(() => {
    try {
      return { gateway: authGateway ?? createDefaultAuthGateway(), error: null };
    } catch (error) {
      return { gateway: null, error };
    }
  }, [authGateway]);
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const requestVersion = useRef(0);
  const activeSession = useRef<AuthSession | null | undefined>(undefined);
  const passwordRecovery = useRef(false);

  const resolveSession = useCallback(async (
    gateway: AuthGateway,
    session: AuthSession | null,
    version: number,
    background = false,
  ) => {
    if (version !== requestVersion.current) return false;
    if (!session) {
      setState({ status: 'signed_out' });
      return true;
    }
    if (passwordRecovery.current) {
      setState({ status: 'password_recovery', userId: session.userId });
      return true;
    }
    if (!session.emailVerified) {
      setState({ status: 'verification_required', email: session.email });
      return true;
    }

    if (!background) setState({ status: 'loading' });
    try {
      const account = await gateway.loadAccountContext(session.userId);
      if (version !== requestVersion.current) return false;
      if (!account.membership) {
        setState({ status: 'unpaired', userId: session.userId, displayName: account.displayName });
        return true;
      }
      setState({
        status: 'paired',
        userId: session.userId,
        email: session.email,
        displayName: account.displayName,
        coupleId: account.membership.coupleId,
        partnerId: account.membership.partnerId,
        memberCount: account.membership.memberCount,
      });
      return true;
    } catch (error) {
      if (version === requestVersion.current) {
        if (background) throw error;
        setState({ status: 'error', message: errorMessage(error) });
      }
      return false;
    }
  }, []);

  const loadRestoredSession = useCallback(async (
    gateway: AuthGateway,
    force = false,
  ) => {
    const observedVersion = requestVersion.current;
    let session: AuthSession | null;
    try {
      session = await gateway.restoreSession();
    } catch (error) {
      if (observedVersion !== requestVersion.current) return;
      if (force) throw error;
      setState({ status: 'error', message: errorMessage(error) });
      return;
    }

    if (observedVersion !== requestVersion.current) return;
    const matchesActiveSession = sameSession(activeSession.current, session);
    if (!force && matchesActiveSession) return;
    const background = force && matchesActiveSession;
    const version = ++requestVersion.current;
    const resolved = await resolveSession(gateway, session, version, background);
    if (resolved && version === requestVersion.current) {
      activeSession.current = session;
    }
  }, [resolveSession]);

  useEffect(() => {
    if (!gatewayResult.gateway) {
      setState({ status: 'error', message: errorMessage(gatewayResult.error) });
      return;
    }
    const gateway = gatewayResult.gateway;
    const unsubscribe = gateway.subscribe((session, event: AuthEvent = '') => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        passwordRecovery.current = true;
        activeSession.current = session;
        ++requestVersion.current;
        setState({ status: 'password_recovery', userId: session.userId });
        return;
      }
      if (sameSession(activeSession.current, session)) return;
      activeSession.current = session;
      const version = ++requestVersion.current;
      void resolveSession(gateway, session, version);
    });
    void loadRestoredSession(gateway);
    return () => {
      ++requestVersion.current;
      activeSession.current = undefined;
      unsubscribe();
    };
  }, [gatewayResult, loadRestoredSession, resolveSession]);

  const value = useMemo<SessionValue>(() => {
    const gateway = gatewayResult.gateway;
    const requiredGateway = () => {
      if (!gateway) throw new Error(errorMessage(gatewayResult.error));
      return gateway;
    };
    return {
      state,
      async signIn(input) {
        const activeGateway = requiredGateway();
        passwordRecovery.current = false;
        await activeGateway.signIn(input);
        await loadRestoredSession(activeGateway, false);
      },
      async signUp(input) {
        const activeGateway = requiredGateway();
        passwordRecovery.current = false;
        const result = await activeGateway.signUp(input);
        if (result === 'verification_required') {
          ++requestVersion.current;
          setState({ status: 'verification_required', email: input.email.trim() });
        } else {
          await loadRestoredSession(activeGateway, false);
        }
        return result;
      },
      async signOut() {
        const activeGateway = requiredGateway();
        passwordRecovery.current = false;
        ++requestVersion.current;
        await activeGateway.signOut();
        activeSession.current = null;
        setState({ status: 'signed_out' });
      },
      async reload() {
        await loadRestoredSession(requiredGateway(), true);
      },
      createPairingInvite(identity) {
        return requiredGateway().createPairingInvite(identity);
      },
      redeemInvite(code) {
        return requiredGateway().redeemInvite(code);
      },
      regenerateInvite() {
        return requiredGateway().regenerateInvite();
      },
      async leaveCurrentCouple() {
        const activeGateway = requiredGateway();
        await activeGateway.leaveCurrentCouple();
        await loadRestoredSession(activeGateway, true);
      },
      async requestPasswordReset(email) {
        const redirectTo = window.location.origin + window.location.pathname;
        await requiredGateway().requestPasswordReset(email, redirectTo);
      },
      updatePassword(password) {
        return requiredGateway().updatePassword(password);
      },
      async updateDisplayName(displayName) {
        const activeGateway = requiredGateway();
        const result = await activeGateway.updateDisplayName(displayName);
        await loadRestoredSession(activeGateway, true);
        return result;
      },
      updateEmail(email) {
        return requiredGateway().updateEmail(email);
      },
    };
  }, [gatewayResult, loadRestoredSession, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession 必须在 SessionProvider 内使用');
  return value;
}
