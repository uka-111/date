import { useCallback, useEffect, useRef, useState } from 'react';
import type { InviteResult } from '../auth/authGateway';
import { useSignOutAction } from '../features/session/useSignOutAction';

interface CloudSetupScreenProps {
  userId: string;
  displayName: string;
  memberCount: number;
  onRegenerateInvite(): Promise<InviteResult>;
  onRefresh(): Promise<void>;
  onSignOut(): Promise<void> | void;
}

export function CloudSetupScreen({ userId, displayName, memberCount, onRegenerateInvite, onRefresh, onSignOut }: CloudSetupScreenProps) {
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const operationInFlight = useRef(false);
  const exclusiveSignOut = useCallback(async () => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    try {
      await onSignOut();
    } finally {
      operationInFlight.current = false;
    }
  }, [onSignOut]);
  const { signingOut, signOutError, runSignOut } = useSignOutAction(exclusiveSignOut);

  async function regenerate() {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      setInvite(await onRegenerateInvite());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成失败，请稍后再试');
    } finally {
      operationInFlight.current = false;
      setLoading(false);
    }
  }

  const refreshMembership = useCallback(async () => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setRefreshing(true);
    setError('');
    try {
      await onRefresh();
    } catch {
      setError('刷新配对状态失败，请稍后再试');
    } finally {
      operationInFlight.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  const busy = loading || refreshing || signingOut;

  useEffect(() => {
    setInvite(null);
  }, [userId]);

  useEffect(() => {
    if (memberCount >= 2) setInvite(null);
  }, [memberCount]);

  useEffect(() => {
    if (memberCount !== 1) return;
    const handleFocus = () => void refreshMembership();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [memberCount, refreshMembership]);

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card">
        <p className="session-eyebrow">{displayName}，欢迎回来</p>
        <h1>{memberCount >= 2 ? '双方已配对' : '等待对方加入'}</h1>
        <p>云端空间已经建立。共享日历会在下一阶段接入，这里不会读取或导入本机旧数据。</p>
        {memberCount === 1 && (
          <>
            <button type="button" disabled={busy} onClick={() => void refreshMembership()}>{refreshing ? '正在刷新...' : '刷新配对状态'}</button>
            <button type="button" disabled={busy} onClick={() => void regenerate()}>{loading ? '正在生成...' : '重新生成邀请码'}</button>
            {invite && (
              <section className="invite-result">
                <p>新的邀请码（7 天有效，使用后失效）：</p>
                <code className="invite-code">{invite.inviteCode}</code>
                <p>到期时间：{new Date(invite.expiresAt).toLocaleString('zh-CN')}</p>
              </section>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {signOutError && <p role="alert">{signOutError}</p>}
        <button className="quiet-action" type="button" disabled={busy} onClick={() => void runSignOut()}>{signingOut ? '正在退出...' : '退出账号'}</button>
      </section>
    </main>
  );
}
