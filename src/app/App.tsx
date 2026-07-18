import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { InvitationDetails } from '../features/invitations/InvitationDetails';
import { InvitationForm } from '../features/invitations/InvitationForm';
import { InvitationList } from '../features/invitations/InvitationList';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { NotificationList } from '../features/notifications/NotificationList';
import { EntryScreen } from '../features/session/EntryScreen';
import type { PartnerId } from '../domain/models';
import { createLocalRepository } from '../storage/localRepository';
import type { DateBookingRepository } from './repository';
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
  const [dataVersion, setDataVersion] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const database = repository.read();
  const refresh = () => setDataVersion((version) => version + 1);

  return (
    <div data-version={dataVersion}>
      <header>
        <Link to="/">我们的约会日历</Link>
        <span>当前身份：{partnerId === 'him' ? '他' : '她'}</span>
        <NotificationBell
          partnerId={partnerId}
          notifications={database.notifications}
          onClick={() => setShowNotifications((visible) => !visible)}
        />
        <button type="button" onClick={signOut}>
          切换身份
        </button>
      </header>

      {showNotifications && (
        <aside aria-label="提醒">
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

      <nav aria-label="主要导航">
        <NavLink to="/" end>
          日历
        </NavLink>
        <NavLink to="/invite">发起约会</NavLink>
        <NavLink to="/invitations">我的安排</NavLink>
      </nav>

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <MonthCalendar
                key={dataVersion}
                repository={repository}
                partnerId={partnerId}
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
      </main>
    </div>
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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SessionProvider>
  );
}
