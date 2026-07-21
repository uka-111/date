import { useEffect, useState, type FormEvent } from 'react';
import type { PairingResult } from '../../auth/authGateway';
import type { PartnerId } from '../../domain/models';
import { useSignOutAction } from './useSignOutAction';

interface PairingScreenProps {
  userId: string;
  displayName: string;
  onCreate(identity: PartnerId): Promise<PairingResult>;
  onRedeem(code: string): Promise<PairingResult>;
  onContinue(): Promise<void> | void;
  onSignOut(): Promise<void> | void;
}

function InviteResult({ result }: { result: PairingResult }) {
  const expiry = result.expiresAt ? new Date(result.expiresAt).toLocaleString('zh-CN') : '';
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function copyInvite() {
    if (!result.inviteCode) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(result.inviteCode);
      setCopied(true);
    } catch {
      setCopyError('复制失败，请长按邀请码手动复制');
    }
  }

  return (
    <section className="invite-result" aria-labelledby="invite-result-heading">
      <h2 id="invite-result-heading">空间已经准备好了</h2>
      <p>把这枚邀请码交给对方：</p>
      <code className="invite-code" aria-label="邀请码文本">{result.inviteCode}</code>
      <button type="button" onClick={() => void copyInvite()}>复制邀请码</button>
      {copied && <p role="status">已复制邀请码</p>}
      {copyError && <p role="alert">{copyError}</p>}
      <p>邀请码 7 天有效，使用后失效。{expiry && `到期时间：${expiry}`}</p>
    </section>
  );
}

export function PairingScreen({ userId, displayName, onCreate, onRedeem, onContinue, onSignOut }: PairingScreenProps) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [identity, setIdentity] = useState<PartnerId | null>(null);
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<PairingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signingOut, signOutError, runSignOut } = useSignOutAction(onSignOut);

  useEffect(() => {
    setMode('choice');
    setIdentity(null);
    setCode('');
    setCreated(null);
    setLoading(false);
    setError('');
  }, [userId]);

  async function createSpace() {
    if (!identity) {
      setError('请先选择你的身份');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setCreated(await onCreate(identity));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  async function joinSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onRedeem(code.trim().toUpperCase());
      await onContinue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加入失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  async function continueIntoSpace() {
    setLoading(true);
    setError('');
    try {
      await onContinue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '进入失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page session-page">
      <section className="entry-card session-card card">
        <p className="session-eyebrow">你好，{displayName}</p>
        <h1>把两个人连在一起</h1>
        <p>创建一个新空间，或用对方发来的邀请码加入。</p>

        {created ? (
          <>
            <InviteResult result={created} />
            {error && <p role="alert">{error}</p>}
            <button type="button" disabled={loading} onClick={() => void continueIntoSpace()}>{loading ? '正在进入...' : '进入我们的空间'}</button>
          </>
        ) : mode === 'choice' ? (
          <div className="pairing-options">
            <button type="button" onClick={() => setMode('create')}>创建我们的空间</button>
            <button type="button" onClick={() => setMode('join')}>加入对方的空间</button>
          </div>
        ) : mode === 'create' ? (
          <section className="identity-choice">
            <h2>创建时，请确认你的身份</h2>
            <div className="identity-options" role="group" aria-label="选择身份">
              <button className="identity-option" type="button" aria-pressed={identity === 'him'} onClick={() => setIdentity('him')}>我是他</button>
              <button className="identity-option" type="button" aria-pressed={identity === 'her'} onClick={() => setIdentity('her')}>我是她</button>
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="button" disabled={loading} onClick={() => void createSpace()}>{loading ? '正在生成...' : '生成邀请码'}</button>
          </section>
        ) : (
          <form onSubmit={joinSpace}>
            <label>
              邀请码
              <input type="text" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? '正在加入...' : '加入空间'}</button>
          </form>
        )}

        {signOutError && <p role="alert">{signOutError}</p>}
        <button className="quiet-action" type="button" disabled={signingOut} onClick={() => void runSignOut()}>{signingOut ? '正在退出...' : '退出账号'}</button>
      </section>
    </main>
  );
}
