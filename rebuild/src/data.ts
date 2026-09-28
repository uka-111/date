import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const STORAGE_PREFIX = 'rebuild-couple-date:';

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(
    key,
    typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue,
  ));

  useEffect(() => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
