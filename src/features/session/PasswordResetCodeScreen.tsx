import { useState, type FormEvent } from 'react';

interface PasswordResetCodeScreenProps {
  email: string;
  onVerify(token: string): Promise<void>;
  onResend(): Promise<void>;
  onBack(): Promise<void> | void;
}

export function PasswordResetCodeScreen({ email, onVerify, onResend, onBack }: PasswordResetCodeScreenProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await onVerify(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '验证码无效或已过期');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError('');
    try {
      await onResend();
      setNotice('验证码已重新发送，请检查邮箱。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '验证码发送失败，请稍后再试');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card" aria-labelledby="password-reset-code-heading">
        <p className="session-eyebrow">确认是你本人</p>
        <h1 id="password-reset-code-heading">输入验证码</h1>
        <p>验证码已发送到 {email}。</p>
        <form onSubmit={submit}>
          <label>
            验证码
            <input
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button type="submit" disabled={loading || token.length !== 6}>{loading ? '正在验证...' : '验证验证码'}</button>
          <button className="quiet-action" type="button" onClick={resend} disabled={resending}>{resending ? '正在重新发送...' : '重新发送验证码'}</button>
          <button className="quiet-action" type="button" onClick={onBack}>返回登录</button>
        </form>
      </section>
    </main>
  );
}
