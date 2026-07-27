import { useState, type FormEvent } from 'react';

interface PasswordResetScreenProps {
  onUpdatePassword(password: string): Promise<void>;
  onComplete(): Promise<void> | void;
}

export function PasswordResetScreen({ onUpdatePassword, onComplete }: PasswordResetScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onUpdatePassword(password);
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '修改密码失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card" aria-labelledby="password-reset-heading">
        <p className="session-eyebrow">重新设置访问方式</p>
        <h1 id="password-reset-heading">设置新密码</h1>
        <p>请设置一个至少 6 位的新密码。</p>
        <form onSubmit={submit}>
          <label>
            新密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
          </label>
          <label>
            确认新密码
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={6} required />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? '正在保存...' : '保存新密码'}</button>
        </form>
      </section>
    </main>
  );
}
