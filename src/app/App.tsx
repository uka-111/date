import { useMemo, useState } from 'react';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { InvitationForm } from '../features/invitations/InvitationForm';
import { EntryScreen } from '../features/session/EntryScreen';
import { createLocalRepository } from '../storage/localRepository';
import { SessionProvider, useSession } from './SessionProvider';

function AppContent() {
  const { partnerId, signOut } = useSession();
  const repository = useMemo(
    () => createLocalRepository(window.localStorage),
    [],
  );
  const [dataVersion, setDataVersion] = useState(0);

  if (!partnerId) return <EntryScreen />;

  return (
    <main>
      <h1>我们的约会日历</h1>
      <p>当前身份：{partnerId === 'him' ? '他' : '她'}</p>
      <button type="button" onClick={signOut}>
        切换身份
      </button>
      <MonthCalendar
        key={dataVersion}
        repository={repository}
        partnerId={partnerId}
      />
      <section aria-labelledby="new-invitation-heading">
        <h2 id="new-invitation-heading">发起新的约会</h2>
        <InvitationForm
          partnerId={partnerId}
          repository={repository}
          onSaved={() => setDataVersion((version) => version + 1)}
        />
      </section>
    </main>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
