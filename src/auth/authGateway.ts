import type { PartnerId } from '../domain/models';

export interface AuthSession {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export type AuthEvent = 'PASSWORD_RECOVERY' | string;

export interface AccountContext {
  displayName: string;
  membership: null | {
    coupleId: string;
    partnerId: PartnerId;
    memberCount: number;
  };
}

export interface PairingResult {
  coupleId: string;
  partnerId: PartnerId;
  inviteCode?: string;
  expiresAt?: string;
}

export interface InviteResult {
  inviteCode: string;
  expiresAt: string;
}

export interface SignInInput {
  email: string;
  password: string;
  persistent: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export type SignUpResult = 'signed_in' | 'verification_required';

export interface AuthGateway {
  restoreSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null, event?: AuthEvent) => void): () => void;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  loadAccountContext(userId: string): Promise<AccountContext>;
  createCouple(identity: PartnerId): Promise<PairingResult>;
  redeemInvite(code: string): Promise<PairingResult>;
  regenerateInvite(): Promise<InviteResult>;
  leaveCurrentCouple(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  verifyPasswordResetCode(email: string, token: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateDisplayName(displayName: string): Promise<string>;
  updateEmail(email: string): Promise<void>;
}
