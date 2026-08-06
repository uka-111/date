import { useEffect, useRef, useState } from 'react';

export function useSignOutAction(onSignOut: () => Promise<void> | void) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function runSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
    } catch {
      if (mounted.current) setSignOutError('退出失败，请稍后再试');
    } finally {
      if (mounted.current) setSigningOut(false);
    }
  }

  return { signingOut, signOutError, runSignOut };
}
