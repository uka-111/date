import type { SupportedStorage } from '@supabase/supabase-js';

type StorageTarget = 'local' | 'session';

export class BrowserAuthStorage implements SupportedStorage {
  private defaultTarget: StorageTarget = 'local';
  private readonly targets = new Map<string, StorageTarget>();

  setPersistent(persistent: boolean) {
    this.defaultTarget = persistent ? 'local' : 'session';
    this.targets.clear();
  }

  getItem(key: string) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue !== null) {
      this.targets.set(key, 'session');
      return sessionValue;
    }

    const localValue = localStorage.getItem(key);
    if (localValue !== null) this.targets.set(key, 'local');
    return localValue;
  }

  setItem(key: string, value: string) {
    const target = this.targets.get(key) ?? this.defaultTarget;
    this.targets.set(key, target);
    if (target === 'session') {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  }

  removeItem(key: string) {
    this.targets.delete(key);
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}
