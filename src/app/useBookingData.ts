import { useCallback, useEffect, useState } from 'react';
import type { DateBookingRepository as CloudRepository } from './bookingRepository';
import type { BookingSnapshot } from './bookingSnapshot';
import type { DateBookingRepository } from './repository';

export function useBookingData(repository: DateBookingRepository) {
  const [database, setDatabase] = useState(() => repository.read());

  const refresh = useCallback(() => {
    setDatabase(repository.read());
  }, [repository]);

  useEffect(() => {
    setDatabase(repository.read());
  }, [repository]);

  return { database, refresh };
}

export type BookingDataState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: BookingSnapshot; refreshing: boolean; online: boolean }
  | { status: 'error'; message: string };

function message(error: unknown) {
  return error instanceof Error ? error.message : '读取共享日历失败，请稍后再试';
}

export function useCloudBookingData(repository: CloudRepository) {
  const [state, setState] = useState<BookingDataState>({ status: 'loading' });
  const [online, setOnline] = useState(() => navigator.onLine);

  const reload = useCallback(async (background = false) => {
    if (background) {
      setState((current) => current.status === 'ready' ? { ...current, refreshing: true } : current);
    } else {
      setState((current) => current.status === 'ready' ? { ...current, refreshing: true } : { status: 'loading' });
    }
    try {
      const snapshot = await repository.load();
      setState({ status: 'ready', snapshot, refreshing: false, online: navigator.onLine });
    } catch (error) {
      setState((current) => current.status === 'ready'
        ? { ...current, refreshing: false }
        : { status: 'error', message: message(error) });
    }
  }, [repository]);

  useEffect(() => {
    void reload();
    const unsubscribe = repository.subscribe(() => { void reload(true); });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [reload, repository]);

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>) => {
    if (!navigator.onLine) throw new Error('网络已断开，恢复连接后再试');
    const value = await operation();
    await reload(true);
    return value;
  }, [reload]);

  const visibleState = state.status === 'ready' ? { ...state, online } : state;
  return { state: visibleState, reload: () => reload(false), runMutation };
}
