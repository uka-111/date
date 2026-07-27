import { useEffect, useState } from 'react';
import type { PartnerId } from '../../domain/models';

interface SettingsPanelProps {
  open: boolean;
  displayName: string;
  email: string;
  partnerId: PartnerId;
  onClose(): void;
  onUpdateDisplayName(name: string): Promise<string>;
  onUpdateEmail(email: string): Promise<void>;
  onUpdatePassword(password: string): Promise<void>;
  onLeaveCouple(): Promise<void>;
  onSignOut(): Promise<void> | void;
}

type EditMode = 'displayName' | 'email' | 'password' | null;

export function SettingsPanel({ open, displayName, email, partnerId, onClose, onUpdateDisplayName, onUpdateEmail, onUpdatePassword, onLeaveCouple, onSignOut }: SettingsPanelProps) {
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nameInput, setNameInput] = useState(displayName);
  const [emailInput, setEmailInput] = useState(email);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    if (!open) return;
    setNameInput(displayName);
    setEmailInput(email);
    setEditMode(null);
    setMessage('');
    setError('');
  }, [displayName, email, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  async function save() {
    setBusy(true); setMessage(''); setError('');
    try {
      if (editMode === 'displayName') {
        await onUpdateDisplayName(nameInput);
        setMessage('用户名已更新');
      } else if (editMode === 'email') {
        await onUpdateEmail(emailInput);
        setMessage('验证邮件已发送，请完成验证后生效');
      } else if (editMode === 'password') {
        if (passwordInput.length < 6) throw new Error('密码至少需要 6 位');
        if (passwordInput !== passwordConfirm) throw new Error('两次输入的密码不一致');
        await onUpdatePassword(passwordInput);
        setPasswordInput(''); setPasswordConfirm(''); setMessage('密码已更新');
      }
      setEditMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请稍后再试');
    } finally { setBusy(false); }
  }

  async function leave() {
    if (!window.confirm('确定取消配对吗？历史日历、预约、照片和文字记录会保留；以后你们重新配对时可以恢复这些内容。')) return;
    setBusy(true); setError('');
    try { await onLeaveCouple(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '取消配对失败，请稍后再试'); }
    finally { setBusy(false); }
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-panel-header">
          <div><p className="session-eyebrow">个人空间</p><h2 id="settings-title">设置</h2></div>
          <button className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}>×</button>
        </div>
        <div className="settings-list">
          <button className="settings-row settings-row-toggle" type="button" aria-expanded={profileExpanded} onClick={() => setProfileExpanded((expanded) => !expanded)}>
            <span><span className="settings-row-icon" aria-hidden="true">◎</span>账号资料</span><span aria-hidden="true">{profileExpanded ? '⌃' : '›'}</span>
          </button>
          {profileExpanded && <div className="profile-details">
            <button className="profile-detail-row" type="button" onClick={() => { setEditMode('displayName'); setMessage(''); setError(''); }}><span>用户名</span><span>{displayName}　›</span></button>
            <button className="profile-detail-row" type="button" onClick={() => { setEditMode('email'); setMessage(''); setError(''); }}><span>邮箱</span><span>{email}　›</span></button>
            <button className="profile-detail-row" type="button" onClick={() => { setEditMode('password'); setMessage(''); setError(''); }}><span>修改密码</span><span>›</span></button>
          </div>}
          <div className="settings-row settings-row-static"><span><span className="settings-row-icon" aria-hidden="true">◌</span>当前身份</span><strong>{partnerId === 'him' ? '他' : '她'}</strong></div>
          <button className="settings-row settings-row-danger" type="button" disabled={busy} onClick={() => void leave()}><span><span className="settings-row-icon" aria-hidden="true">↔</span>取消配对</span><span aria-hidden="true">›</span></button>
          <button className="settings-row settings-row-danger" type="button" disabled={busy} onClick={() => void onSignOut()}><span><span className="settings-row-icon" aria-hidden="true">↪</span>退出账号</span><span aria-hidden="true">›</span></button>
        </div>
        {editMode && <section className="settings-editor" aria-label="编辑账号资料">
          <h3>{editMode === 'displayName' ? '修改用户名' : editMode === 'email' ? '修改邮箱' : '修改密码'}</h3>
          {editMode === 'displayName' && <input value={nameInput} onChange={(event) => setNameInput(event.target.value)} maxLength={40} autoFocus />}
          {editMode === 'email' && <input type="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} autoFocus />}
          {editMode === 'password' && <><input type="password" placeholder="新密码（至少 6 位）" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} autoFocus /><input type="password" placeholder="再次输入新密码" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></>}
          <div className="settings-editor-actions"><button type="button" className="quiet-action" onClick={() => setEditMode(null)}>取消</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? '正在保存...' : '保存'}</button></div>
        </section>}
        {message && <p className="settings-success" role="status">{message}</p>}
        {error && <p className="settings-error" role="alert">{error}</p>}
      </aside>
    </div>
  );
}
