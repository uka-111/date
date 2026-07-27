import { useState, type FormEvent } from 'react';
import type { SignInInput, SignUpInput, SignUpResult } from '../../auth/authGateway';

interface AuthScreenProps {
  onSignIn(input: SignInInput): Promise<void>;
  onSignUp(input: SignUpInput): Promise<SignUpResult>;
  onRequestPasswordReset?(email: string): Promise<void>;
}

export function AuthScreen({ onSignIn, onSignUp, onRequestPasswordReset = async () => {} }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [persistent, setPersistent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function chooseMode(nextMode: 'login' | 'register' | 'forgot') {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'forgot') {
        await onRequestPasswordReset(email);
        setNotice('验证码已发送，请检查你的邮箱。');
      } else if (mode === 'login') {
        await onSignIn({ email, password, persistent });
      } else {
        const result = await onSignUp({ email, password, displayName });
        if (result === 'verification_required') {
          setNotice(`注册完成，请检查 ${email.trim()} 的验证邮件。`);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card" aria-labelledby="auth-heading">
        <p className="session-eyebrow">只属于两个人的小小空间</p>
        <h1 id="auth-heading">留一页给我们</h1>
        <p>把值得期待的日子，安静地留在这里。</p>

        <div className="auth-tabs" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => chooseMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => chooseMode('register')}>注册</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              昵称
              <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required maxLength={40} />
            </label>
          )}
          <label>
            邮箱
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          {mode !== 'forgot' && <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} />
          </label>}
          {mode === 'login' && (
            <label className="checkbox-row">
              <input type="checkbox" checked={persistent} onChange={(event) => setPersistent(event.target.checked)} />
              保持登录
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button type="submit" disabled={loading}>
          {loading ? (mode === 'forgot' ? '正在发送...' : mode === 'login' ? '正在登录...' : '正在创建...') : (mode === 'forgot' ? '发送验证码' : mode === 'login' ? '登录' : '创建账号')}
          </button>
          {mode === 'login' && <button className="quiet-action" type="button" onClick={() => chooseMode('forgot')}>忘记密码？</button>}
          {mode === 'forgot' && <button className="quiet-action" type="button" onClick={() => chooseMode('login')}>返回登录</button>}
        </form>
      </section>
    </main>
  );
}
