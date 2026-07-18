import { useMemo } from 'react';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { EntryScreen } from '../features/session/EntryScreen';
import { createLocalRepository } from '../storage/localRepository';
import { SessionProvider, useSession } from './SessionProvider';

function AppContent() {
  const { partnerId, signOut } = useSession();
  const repository = useMemo(
    () => createLocalRepository(window.localStorage),
    [],
  );

  if (!partnerId) return <EntryScreen />;

  return (
    <main>
      <h1>我们的约会日历</h1>
      <p>当前身份：{partnerId === 'him' ? '他' : '她'}</p>
      <button type="button" onClick={signOut}>
        切换身份
      </button>
      <MonthCalendar repository={repository} partnerId={partnerId} />
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
