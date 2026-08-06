import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { PartnerId } from '../domain/models';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import type { NotificationRecord } from '../storage/schema';

interface AppShellProps {
  partnerId: PartnerId;
  notifications: NotificationRecord[];
  onNotificationClick: () => void;
  onSignOut: () => void;
  onLeaveCouple?: () => Promise<void>;
  displayName?: string;
  email?: string;
  onUpdateDisplayName?(name: string): Promise<string>;
  onUpdateEmail?(email: string): Promise<void>;
  onUpdatePassword?(password: string): Promise<void>;
  children: ReactNode;
}
export function AppShell({
  partnerId,
  notifications,
  onNotificationClick,
  onSignOut,
  onLeaveCouple = async () => {},
  displayName = '',
  email = '',
  onUpdateDisplayName = async () => displayName,
  onUpdateEmail = async () => {},
  onUpdatePassword = async () => {},
  children,
}: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="留一页给我们首页">
          <span>留一页给我们</span>
        </Link>
        <div className="topbar-actions">
          <NotificationBell
            partnerId={partnerId}
            notifications={notifications}
            onClick={onNotificationClick}
          />
          <button className="icon-button settings-trigger" type="button" aria-label="设置" onClick={() => setSettingsOpen(true)}>⚙</button>
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
      <SettingsPanel open={settingsOpen} displayName={displayName} email={email} partnerId={partnerId} onClose={() => setSettingsOpen(false)} onUpdateDisplayName={onUpdateDisplayName} onUpdateEmail={onUpdateEmail} onUpdatePassword={onUpdatePassword} onLeaveCouple={onLeaveCouple} onSignOut={onSignOut} />
    </div>
  );
}
