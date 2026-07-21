import { useSignOutAction } from './useSignOutAction';

interface VerifyEmailScreenProps {
  email: string;
  onSignOut(): Promise<void> | void;
}

export function VerifyEmailScreen({ email, onSignOut }: VerifyEmailScreenProps) {
  const { signingOut, signOutError, runSignOut } = useSignOutAction(onSignOut);

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card">
        <p className="session-eyebrow">还差一步</p>
        <h1>请验证你的邮箱</h1>
        <p>我们已将验证链接发送到 <strong>{email}</strong>。完成验证后，再回来重新登录。</p>
        {signOutError && <p role="alert">{signOutError}</p>}
        <button type="button" disabled={signingOut} onClick={() => void runSignOut()}>{signingOut ? '正在退出...' : '退出并重新登录'}</button>
      </section>
    </main>
  );
}
