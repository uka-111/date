import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PartnerId } from '../domain/models';

const SESSION_KEY = 'couple-date-partner';

interface SessionValue {
  partnerId: PartnerId | null;
  selectPartner: (partnerId: PartnerId) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function readPartner(): PartnerId | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  return stored === 'him' || stored === 'her' ? stored : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [partnerId, setPartnerId] = useState<PartnerId | null>(readPartner);

  const value = useMemo<SessionValue>(
    () => ({
      partnerId,
      selectPartner(nextPartner) {
        sessionStorage.setItem(SESSION_KEY, nextPartner);
        setPartnerId(nextPartner);
      },
      signOut() {
        sessionStorage.removeItem(SESSION_KEY);
        setPartnerId(null);
      },
    }),
    [partnerId],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession 必须在 SessionProvider 内使用');
  return value;
}
