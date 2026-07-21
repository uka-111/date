interface VerifyEmailScreenProps {
  email: string;
  onSignOut(): Promise<void> | void;
}

export function VerifyEmailScreen({ email, onSignOut }: VerifyEmailScreenProps) {
  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card">
        <p className="session-eyebrow">还差一步</p>
        <h1>请验证你的邮箱</h1>
        <p>我们已将验证链接发送到 <strong>{email}</strong>。完成验证后，再回来重新登录。</p>
        <button type="button" onClick={() => void onSignOut()}>退出并重新登录</button>
      </section>
    </main>
  );
}
