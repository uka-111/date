import { BrowserAuthStorage } from './browserAuthStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('writes persistent sessions to localStorage by default', () => {
  const storage = new BrowserAuthStorage();

  storage.setItem('auth-token', 'persistent');

  expect(localStorage.getItem('auth-token')).toBe('persistent');
  expect(sessionStorage.getItem('auth-token')).toBeNull();
});

it('writes session-only sessions to sessionStorage', () => {
  const storage = new BrowserAuthStorage();

  storage.setPersistent(false);
  storage.setItem('auth-token', 'temporary');

  expect(sessionStorage.getItem('auth-token')).toBe('temporary');
  expect(localStorage.getItem('auth-token')).toBeNull();
});

it('keeps refreshed values in sessionStorage after restoring from it', () => {
  sessionStorage.setItem('auth-token', 'old');
  const storage = new BrowserAuthStorage();

  expect(storage.getItem('auth-token')).toBe('old');
  storage.setItem('auth-token', 'refreshed');

  expect(sessionStorage.getItem('auth-token')).toBe('refreshed');
  expect(localStorage.getItem('auth-token')).toBeNull();
});

it('lets an explicit login preference replace a previously restored target', () => {
  localStorage.setItem('auth-token', 'old');
  const storage = new BrowserAuthStorage();
  expect(storage.getItem('auth-token')).toBe('old');

  storage.setPersistent(false);
  storage.setItem('auth-token', 'new');

  expect(sessionStorage.getItem('auth-token')).toBe('new');
  expect(localStorage.getItem('auth-token')).toBeNull();
});

it('removes a key from both browser stores', () => {
  localStorage.setItem('auth-token', 'local');
  sessionStorage.setItem('auth-token', 'session');
  const storage = new BrowserAuthStorage();

  storage.removeItem('auth-token');

  expect(localStorage.getItem('auth-token')).toBeNull();
  expect(sessionStorage.getItem('auth-token')).toBeNull();
});
