import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { PartnerId } from '../domain/models';
import { NotificationBell } from '../features/notifications/NotificationBell';
import type { NotificationRecord } from '../storage/schema';

interface AppShellProps {
  partnerId: PartnerId;
  notifications: NotificationRecord[];
  onNotificationClick: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function AppShell({
  partnerId,
  notifications,
  onNotificationClick,
  onSignOut,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="我们的约会日历首页">
          <span aria-hidden="true">♡</span>
          <span>我们的约会日历</span>
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
            切换身份
          </button>
        </div>
      </header>

      <nav className="primary-nav" aria-label="主要导航">
        <NavLink to="/" end>
          <span aria-hidden="true">📅</span>
          日历
        </NavLink>
        <NavLink to="/invite">
          <span aria-hidden="true">✉</span>
          发起邀请
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
