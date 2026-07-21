import { useState } from 'react';
import type { InviteResult } from '../auth/authGateway';

interface CloudSetupScreenProps {
  displayName: string;
  memberCount: number;
  onRegenerateInvite(): Promise<InviteResult>;
  onSignOut(): Promise<void> | void;
}

export function CloudSetupScreen({ displayName, memberCount, onRegenerateInvite, onSignOut }: CloudSetupScreenProps) {
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card">
        <p className="session-eyebrow">{displayName}，欢迎回来</p>
        <h1>{memberCount >= 2 ? '双方已配对' : '等待对方加入'}</h1>
        <p>云端空间已经建立。共享日历会在下一阶段接入，这里不会读取或导入本机旧数据。</p>
        {memberCount === 1 && (
          <>
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
        <button className="quiet-action" type="button" onClick={() => void onSignOut()}>退出账号</button>
      </section>
    </main>
  );
}
