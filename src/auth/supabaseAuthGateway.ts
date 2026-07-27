import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { PartnerId } from '../domain/models';
import type { Database } from '../lib/database.types';
import { getSupabaseBrowserRuntime } from '../lib/supabaseClient';
import {
  type AccountContext,
  type AuthEvent,
  type AuthGateway,
  type AuthSession,
  type InviteResult,
  type PairingResult,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from './authGateway';
import { BrowserAuthStorage } from './browserAuthStorage';

function stableError(error: unknown): Error {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : String(error);
  const message = raw.toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return new Error('邮箱或密码不正确');
  }
  if (message.includes('email not confirmed')) return new Error('请先完成邮箱验证');
  if (message.includes('already registered') || message.includes('already exists')) {
    return new Error('这个邮箱已经注册');
  }
  if (message.includes('weak password') || message.includes('password') && (message.includes('short') || message.includes('6 character'))) {
    return new Error('密码至少需要 6 位');
  }
  if (message.includes('invite unavailable') || message.includes('invite') || message.includes('邀请码')) {
    return new Error('邀请码不可用或已失效');
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to connect')) {
    return new Error('网络连接失败，请稍后再试');
  }
  if (raw === 'Supabase 连接信息尚未配置') return new Error(raw);
  return new Error('操作失败，请稍后再试');
}

function requireData<T>(data: T | null, error: unknown): T {
  if (error) throw stableError(error);
  if (data === null) throw new Error('操作失败，请稍后再试');
  return data;
}

function mapUser(user: User): AuthSession {
  if (!user.email) throw new Error('登录账户缺少邮箱信息');
  return {
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  };
}

function mapSession(session: Session | null) {
  return session ? mapUser(session.user) : null;
}

function assertPartnerId(identity: string): PartnerId {
  if (identity !== 'him' && identity !== 'her') throw new Error('账户配对身份无效');
  return identity;
}

export function createSupabaseAuthGateway(
  client: SupabaseClient<Database>,
  storage: BrowserAuthStorage,
): AuthGateway {
  return {
    async restoreSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw stableError(error);
      return mapSession(data.session);
    },

    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener(mapSession(session), event as AuthEvent);
      });
      return () => data.subscription.unsubscribe();
    },

    async signIn(input: SignInInput) {
      storage.setPersistent(input.persistent);
      const { error } = await client.auth.signInWithPassword({
        email: input.email.trim(),
        password: input.password,
      });
      if (error) throw stableError(error);
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      storage.setPersistent(true);
      const { data, error } = await client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: { data: { display_name: input.displayName.trim() } },
      });
      if (error) throw stableError(error);
      return data.session ? 'signed_in' : 'verification_required';
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw stableError(error);
    },

    async loadAccountContext(userId: string): Promise<AccountContext> {
      const profileResponse = await client
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      const profile = requireData(profileResponse.data, profileResponse.error);

      const membershipResponse = await client
        .from('couple_members')
        .select('couple_id, identity')
        .eq('user_id', userId)
        .is('left_at', null)
        .maybeSingle();
      if (membershipResponse.error) throw stableError(membershipResponse.error);
      if (!membershipResponse.data) {
        return { displayName: profile.display_name, membership: null };
      }

      const countResponse = await client
        .from('couple_members')
        .select('*', { count: 'exact', head: true })
        .eq('couple_id', membershipResponse.data.couple_id)
        .is('left_at', null);
      if (countResponse.error) throw stableError(countResponse.error);

      return {
        displayName: profile.display_name,
        membership: {
          coupleId: membershipResponse.data.couple_id,
          partnerId: assertPartnerId(membershipResponse.data.identity),
          memberCount: countResponse.count ?? 0,
        },
      };
    },

    async createCouple(identity: PartnerId): Promise<PairingResult> {
      const response = await client.rpc('create_couple_with_invite', { p_identity: identity });
      const row = requireData(response.data?.[0] ?? null, response.error);
      return {
        coupleId: row.couple_id,
        partnerId: identity,
        inviteCode: row.invite_code,
        expiresAt: row.expires_at,
      };
    },

    async redeemInvite(code: string): Promise<PairingResult> {
      const response = await client.rpc('redeem_couple_invite', { p_invite_code: code.trim().toUpperCase() });
      const row = requireData(response.data?.[0] ?? null, response.error);
      return { coupleId: row.couple_id, partnerId: assertPartnerId(row.identity) };
    },

    async regenerateInvite(): Promise<InviteResult> {
      const response = await client.rpc('regenerate_couple_invite');
      const row = requireData(response.data?.[0] ?? null, response.error);
      return { inviteCode: row.invite_code, expiresAt: row.expires_at };
    },

    async leaveCurrentCouple() {
      const { error } = await client.rpc('leave_current_couple');
      if (error) throw stableError(error);
    },

    async requestPasswordReset(email: string, redirectTo: string) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw stableError(error);
    },

    async updatePassword(password: string) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw stableError(error);
    },
  };
}

export function createDefaultAuthGateway() {
  const runtime = getSupabaseBrowserRuntime();
  return createSupabaseAuthGateway(runtime.client, runtime.storage);
}
