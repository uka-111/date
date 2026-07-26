import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { PartnerId } from '../domain/models';
import { NotificationBell } from '../features/notifications/NotificationBell';
import type { NotificationRecord } from '../storage/schema';

interface AppShellProps {
  partnerId: PartnerId;
  notifications: NotificationRecord[];
  onNotificationClick: () => void;
  onSignOut: () => void;
  onLeaveCouple?: () => Promise<void>;
  children: ReactNode;
}

export function AppShell({
  partnerId,
  notifications,
  onNotificationClick,
  onSignOut,
  onLeaveCouple = async () => {},
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="留一页给我们首页">
          <span aria-hidden="true">♡</span>
          <span>留一页给我们</span>
        </Link>
        <div className="topbar-actions">
          <span className="identity-pill">
            当前身份：{partnerId === 'him' ? '他' : '她'}
          </span>
          <NotificationBell
            partnerId={partnerId}
            notifications={notifications}
            onClick={onNotificationClick}
          />
          <button className="text-button" type="button" onClick={onSignOut}>
            退出账号
          </button>
          <LeaveCoupleButton onLeaveCouple={onLeaveCouple} />
        </div>
      </header>

      <nav className="primary-nav" aria-label="主要导航">
        <NavLink to="/" end>
          <span aria-hidden="true">📅</span>
          日历
        </NavLink>
        <NavLink to="/invite">
          <span aria-hidden="true">💌</span>
          发起约会
        </NavLink>
        <NavLink to="/invitations">
          <span aria-hidden="true">💕</span>
          我的安排
        </NavLink>
      </nav>

      <main className="page-container">{children}</main>
    </div>
  );
}

function LeaveCoupleButton({ onLeaveCouple }: { onLeaveCouple: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function leave() {
    if (!window.confirm('确定取消配对吗？历史日历、预约、照片和文字记录会保留；以后你们重新配对时可以恢复这些内容。')) return;
    setBusy(true);
    setError('');
    try {
      await onLeaveCouple();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '取消配对失败，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return <span className="leave-couple-control">
    <button className="text-button danger-text-button" type="button" disabled={busy} onClick={() => void leave()}>
      {busy ? '正在取消配对...' : '取消配对'}
    </button>
    {error && <span role="alert">{error}</span>}
  </span>;
}
