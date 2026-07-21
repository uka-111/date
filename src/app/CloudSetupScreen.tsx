import { useCallback, useEffect, useState } from 'react';
import type { InviteResult } from '../auth/authGateway';
import { useSignOutAction } from '../features/session/useSignOutAction';

interface CloudSetupScreenProps {
  displayName: string;
  memberCount: number;
  onRegenerateInvite(): Promise<InviteResult>;
  onRefresh(): Promise<void>;
  onSignOut(): Promise<void> | void;
}

export function CloudSetupScreen({ displayName, memberCount, onRegenerateInvite, onRefresh, onSignOut }: CloudSetupScreenProps) {
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { signingOut, signOutError, runSignOut } = useSignOutAction(onSignOut);

  async function regenerate() {
    setLoading(true);
    setError('');
    try {
      setInvite(await onRegenerateInvite());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  const refreshMembership = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      await onRefresh();
    } catch {
      setError('刷新配对状态失败，请稍后再试');
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

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
            <button type="button" disabled={refreshing} onClick={() => void refreshMembership()}>{refreshing ? '正在刷新...' : '刷新配对状态'}</button>
            <button type="button" disabled={loading} onClick={() => void regenerate()}>{loading ? '正在生成...' : '重新生成邀请码'}</button>
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
        <button className="quiet-action" type="button" disabled={signingOut} onClick={() => void runSignOut()}>{signingOut ? '正在退出...' : '退出账号'}</button>
      </section>
    </main>
  );
}
