import { useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { DateBookingRepository } from './bookingRepository';
import { createCloudUiAdapter } from './cloudUiAdapter';
import { useCloudBookingData } from './useBookingData';
import { AppShell } from './AppShell';
import { CalendarWorkspace } from '../features/calendar/CalendarWorkspace';
import { InvitationDetails } from '../features/invitations/InvitationDetails';
import { InvitationForm } from '../features/invitations/InvitationForm';
import { InvitationList } from '../features/invitations/InvitationList';
import { NotificationList } from '../features/notifications/NotificationList';
import type { PartnerId } from '../domain/models';
import { createSupabasePhotoRepository } from '../storage/supabasePhotoRepository';
import { getSupabaseBrowserRuntime } from '../lib/supabaseClient';
import type { PhotoRepository } from '../storage/photoRepository';

export function InvitationRoute({ partnerId, repository, onChanged }: { partnerId: PartnerId; repository: ReturnType<typeof createCloudUiAdapter>; onChanged: () => void }) {
  const { id } = useParams();
  const invitation = repository.read().invitations.find((value) => value.id === id);
  if (!invitation) return <section><h2>没有找到这个约会</h2><Link to="/">返回共享日历</Link></section>;
  return (
    <section className="details-page">
      <Link className="text-button invitation-back-link" to="/invitations">返回</Link>
      <InvitationDetails invitation={invitation} partnerId={partnerId} repository={repository} onUpdated={onChanged} />
    </section>
  );
}

export function BookingDataScreen({ repository, coupleId, userId, photoRepository: photoRepositoryOverride, displayName, email, partnerId, onSignOut, onLeaveCouple, onUpdateDisplayName, onUpdateEmail, onUpdatePassword }: { repository: DateBookingRepository; coupleId: string; userId: string; photoRepository?: PhotoRepository; displayName: string; email: string; partnerId: PartnerId; onSignOut: () => void; onLeaveCouple: () => Promise<void>; onUpdateDisplayName: (name: string) => Promise<string>; onUpdateEmail: (email: string) => Promise<void>; onUpdatePassword: (password: string) => Promise<void> }) {
  const { state, reload } = useCloudBookingData(repository);
  const [syncError, setSyncError] = useState('');
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const photoRepository = useMemo(() => photoRepositoryOverride ?? createSupabasePhotoRepository(getSupabaseBrowserRuntime().client, coupleId, userId), [coupleId, photoRepositoryOverride, userId]);

  if (state.status === 'loading') return <main className="session-state"><p>正在加载共享日历...</p></main>;
  if (state.status === 'error') return <main className="session-state"><p role="alert">{state.message}</p><button type="button" onClick={() => void reload()}>重试</button></main>;

  const legacyRepository = createCloudUiAdapter(
    state.snapshot,
    repository,
    () => void reload(),
    setSyncError,
    partnerId,
  );

  return <AppShell partnerId={partnerId} displayName={displayName} email={email} notifications={state.snapshot.notifications} onNotificationClick={() => setShowNotifications((visible) => !visible)} onSignOut={onSignOut} onLeaveCouple={onLeaveCouple} onUpdateDisplayName={onUpdateDisplayName} onUpdateEmail={onUpdateEmail} onUpdatePassword={onUpdatePassword}>
      {showNotifications && <aside className="notification-panel card" aria-label="提醒"><h2>提醒</h2><NotificationList partnerId={partnerId} notifications={state.snapshot.notifications} onOpen={(notification) => {
        legacyRepository.markNotificationRead(notification.id, partnerId, new Date().toISOString());
        setShowNotifications(false); navigate(`/invitations/${notification.invitationId}`);
      }} /></aside>}
      {state.refreshing && <p role="status">正在更新...</p>}
      {syncError && <p role="alert">{syncError}</p>}
      <Routes>
        <Route path="/" element={<><h1 className="visually-hidden">共享月历</h1><CalendarWorkspace repository={legacyRepository} partnerId={partnerId} photoRepository={photoRepository} /></>} />
        <Route path="/invite" element={<section className="form-page"><h1>发起新的约会</h1><InvitationForm partnerId={partnerId} repository={legacyRepository} onSaved={() => navigate('/invitations')} /></section>} />
        <Route path="/invitations" element={<section><h1>我的安排</h1><InvitationList partnerId={partnerId} invitations={state.snapshot.invitations} onSelect={(invitation) => navigate(`/invitations/${invitation.id}`)} /></section>} />
        <Route path="/invitations/:id" element={<InvitationRoute partnerId={partnerId} repository={legacyRepository} onChanged={() => void reload()} />} />
        <Route path="*" element={<section><h1>页面不存在</h1><Link to="/">返回共享日历</Link></section>} />
      </Routes>
    </AppShell>;
}
