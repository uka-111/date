import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { CalendarWorkspace } from '../features/calendar/CalendarWorkspace';
import { createPhotoRepository } from '../storage/photoRepository';
import { InvitationDetails } from '../features/invitations/InvitationDetails';
import { InvitationForm } from '../features/invitations/InvitationForm';
import { InvitationList } from '../features/invitations/InvitationList';
import { NotificationList } from '../features/notifications/NotificationList';
import { EntryScreen } from '../features/session/EntryScreen';
import type { PartnerId } from '../domain/models';
import { createLocalRepository } from '../storage/localRepository';
import type { DateBookingRepository } from './repository';
import { AppShell } from './AppShell';
import { DataRecoveryScreen } from './DataRecoveryScreen';
import { SessionProvider, useSession } from './SessionProvider';

interface InvitationRouteProps {
  partnerId: PartnerId;
  repository: DateBookingRepository;
  onDataChanged: () => void;
}

function InvitationRoute({
  partnerId,
  repository,
  onDataChanged,
}: InvitationRouteProps) {
  const { id } = useParams();
  const invitation = repository
    .read()
    .invitations.find((value) => value.id === id);

  useEffect(() => {
    if (!id) return;
    const unread = repository
      .read()
      .notifications.filter(
        (notification) =>
          notification.invitationId === id &&
          notification.recipientId === partnerId &&
          notification.readAt === null,
      );
    if (unread.length === 0) return;

    const now = new Date().toISOString();
    unread.forEach((notification) =>
      repository.markNotificationRead(notification.id, partnerId, now),
    );
    onDataChanged();
  }, [id, partnerId, repository, onDataChanged]);

  if (!invitation) {
    return (
      <section>
        <h2>没有找到这个约会</h2>
        <p>它可能已经被删除，或者链接不完整。</p>
        <Link to="/">返回共享日历</Link>
      </section>
    );
  }

  return (
    <InvitationDetails
      invitation={invitation}
      partnerId={partnerId}
      repository={repository}
      onUpdated={onDataChanged}
    />
  );
}

function AuthenticatedApp({ partnerId }: { partnerId: PartnerId }) {
  const { signOut } = useSession();
  const navigate = useNavigate();
  const repository = useMemo(
    () => createLocalRepository(window.localStorage),
    [],
  );
  const photoRepository = useMemo(() => createPhotoRepository(), []);
  const [dataVersion, setDataVersion] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const refresh = () => setDataVersion((version) => version + 1);
  let database;

  try {
    database = repository.read();
  } catch {
    return (
      <DataRecoveryScreen
        onReset={() => {
          repository.reset();
          refresh();
        }}
      />
    );
  }

  return (
    <AppShell
      partnerId={partnerId}
      notifications={database.notifications}
      onNotificationClick={() =>
        setShowNotifications((visible) => !visible)
      }
      onSignOut={signOut}
    >
      {showNotifications && (
        <aside className="notification-panel card" aria-label="提醒">
          <h2>提醒</h2>
          <NotificationList
            partnerId={partnerId}
            notifications={database.notifications}
            onOpen={(notification) => {
              if (notification.readAt === null) {
                repository.markNotificationRead(
                  notification.id,
                  partnerId,
                  new Date().toISOString(),
                );
              }
              setShowNotifications(false);
              refresh();
              navigate(`/invitations/${notification.invitationId}`);
            }}
          />
        </aside>
      )}
      <div data-version={dataVersion}>
        <Routes>
          <Route
            path="/"
            element={
              <CalendarWorkspace
                key={dataVersion}
                repository={repository}
                partnerId={partnerId}
                photoRepository={photoRepository}
              />
            }
          />
          <Route
            path="/invite"
            element={
              <section aria-labelledby="new-invitation-heading">
                <h1 id="new-invitation-heading">发起新的约会</h1>
                <InvitationForm
                  partnerId={partnerId}
                  repository={repository}
                  onSaved={() => {
                    refresh();
                    navigate('/invitations');
                  }}
                />
              </section>
            }
          />
          <Route
            path="/invitations"
            element={
              <section>
                <h1>我的安排</h1>
                <InvitationList
                  partnerId={partnerId}
                  invitations={database.invitations}
                  onSelect={(invitation) =>
                    navigate(`/invitations/${invitation.id}`)
                  }
                />
              </section>
            }
          />
          <Route
            path="/invitations/:id"
            element={
              <InvitationRoute
                partnerId={partnerId}
                repository={repository}
                onDataChanged={refresh}
              />
            }
          />
          <Route
            path="*"
            element={
              <section>
                <h1>页面不存在</h1>
                <Link to="/">返回共享日历</Link>
              </section>
            }
          />
        </Routes>
      </div>
    </AppShell>
  );
}

function AppContent() {
  const { partnerId } = useSession();
  if (!partnerId) return <EntryScreen />;
  return <AuthenticatedApp partnerId={partnerId} />;
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppContent />
      </BrowserRouter>
    </SessionProvider>
  );
}
