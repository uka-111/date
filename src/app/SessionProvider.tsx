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
  | { status: 'unpaired'; userId: string; displayName: string }
  | { status: 'paired'; userId: string; displayName: string; coupleId: string; partnerId: PartnerId; memberCount: number }
  | { status: 'error'; message: string };

interface SessionValue {
  state: SessionState;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
  createCouple(identity: PartnerId): Promise<PairingResult>;
  redeemInvite(code: string): Promise<PairingResult>;
  regenerateInvite(): Promise<InviteResult>;
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

  const resolveSession = useCallback(async (
    gateway: AuthGateway,
    session: AuthSession | null,
    version: number,
  ) => {
    if (version !== requestVersion.current) return;
    if (!session) {
      setState({ status: 'signed_out' });
      return;
    }
    if (!session.emailVerified) {
      setState({ status: 'verification_required', email: session.email });
      return;
    }

    setState({ status: 'loading' });
    try {
      const account = await gateway.loadAccountContext(session.userId);
      if (version !== requestVersion.current) return;
      if (!account.membership) {
        setState({ status: 'unpaired', userId: session.userId, displayName: account.displayName });
        return;
      }
      setState({
        status: 'paired',
        userId: session.userId,
        displayName: account.displayName,
        coupleId: account.membership.coupleId,
        partnerId: account.membership.partnerId,
        memberCount: account.membership.memberCount,
      });
    } catch (error) {
      if (version === requestVersion.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, []);

  const loadRestoredSession = useCallback(async (
    gateway: AuthGateway,
    force = false,
  ) => {
    const observedVersion = requestVersion.current;
    try {
      const session = await gateway.restoreSession();
      if (observedVersion !== requestVersion.current) return;
      if (!force && sameSession(activeSession.current, session)) return;
      activeSession.current = session;
      const version = ++requestVersion.current;
      await resolveSession(gateway, session, version);
    } catch (error) {
      if (observedVersion === requestVersion.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, [resolveSession]);

  useEffect(() => {
    if (!gatewayResult.gateway) {
      setState({ status: 'error', message: errorMessage(gatewayResult.error) });
      return;
    }
    const gateway = gatewayResult.gateway;
    const unsubscribe = gateway.subscribe((session) => {
      if (sameSession(activeSession.current, session)) return;
      activeSession.current = session;
      const version = ++requestVersion.current;
      void resolveSession(gateway, session, version);
    });
    void loadRestoredSession(gateway);
    return unsubscribe;
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
        await activeGateway.signIn(input);
        await loadRestoredSession(activeGateway, false);
      },
      async signUp(input) {
        const activeGateway = requiredGateway();
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
        ++requestVersion.current;
        await activeGateway.signOut();
        activeSession.current = null;
        setState({ status: 'signed_out' });
      },
      async reload() {
        await loadRestoredSession(requiredGateway(), true);
      },
      createCouple(identity) {
        return requiredGateway().createCouple(identity);
      },
      redeemInvite(code) {
        return requiredGateway().redeemInvite(code);
      },
      regenerateInvite() {
        return requiredGateway().regenerateInvite();
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
