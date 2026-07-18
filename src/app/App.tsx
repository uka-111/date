import { EntryScreen } from '../features/session/EntryScreen';
import { SessionProvider, useSession } from './SessionProvider';

function AppContent() {
  const { partnerId, signOut } = useSession();

  if (!partnerId) return <EntryScreen />;

  return (
    <main>
      <h1>我们的约会日历</h1>
      <p>当前身份：{partnerId === 'him' ? '他' : '她'}</p>
      <button type="button" onClick={signOut}>
        切换身份
      </button>
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
