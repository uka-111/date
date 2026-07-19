import { useCallback, useState } from 'react';
import type { DateBookingRepository } from './repository';

export function useBookingData(repository: DateBookingRepository) {
  const [database, setDatabase] = useState(() => repository.read());

  const refresh = useCallback(() => {
    setDatabase(repository.read());
  }, [repository]);

  return { database, refresh };
}
