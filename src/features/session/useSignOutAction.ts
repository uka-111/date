import { useState } from 'react';

export function useSignOutAction(onSignOut: () => Promise<void> | void) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  async function runSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
    } catch {
      setSignOutError('退出失败，请稍后再试');
    } finally {
      setSigningOut(false);
    }
  }

  return { signingOut, signOutError, runSignOut };
}
