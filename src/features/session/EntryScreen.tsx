import { useState, type FormEvent } from 'react';
import { useSession } from '../../app/SessionProvider';

const fallbackPassphrase = '2021121';

export function EntryScreen() {
  const { selectPartner } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expectedPassphrase =
      import.meta.env.VITE_SHARED_PASSPHRASE || fallbackPassphrase;

    if (passphrase !== expectedPassphrase) {
      setError('口令不正确');
      return;
    }

    setError('');
    setPassphrase('');
    setUnlocked(true);
  }

  return (
    <main className="entry-page">
      <section className="entry-card card">
        <h1>我们的约会日历</h1>
        <p>把空闲时间和下一次约会，认真地告诉彼此。</p>

      {!unlocked ? (
        <form onSubmit={unlock}>
          <label htmlFor="shared-passphrase">专属口令</label>
          <input
            id="shared-passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="current-password"
          />
          {error && <p role="alert">{error}</p>}
          <button type="submit">进入我们的日历</button>
        </form>
      ) : (
        <section className="identity-choice" aria-labelledby="identity-heading">
          <h2 id="identity-heading">今天是谁在使用？</h2>
          <button type="button" onClick={() => selectPartner('him')}>
            我是他
          </button>
          <button type="button" onClick={() => selectPartner('her')}>
            我是她
          </button>
        </section>
      )}

        <p>
          本地口令只用于避免误入；正式上线时会升级为安全的双人登录。
        </p>
      </section>
    </main>
  );
}
