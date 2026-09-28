import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { usePersistentState } from './data';
import { createCalendarMarks, createRecordsViewModel, type CalendarMark as ViewCalendarMark, type RecordsViewModel } from './viewModel';
import { useCloudSnapshot } from './cloudBridge';
import type { PhotoRecord } from '../../src/storage/photoRepository';
import type { InvitationResponse } from '../../src/domain/invitations';
import { getSupabaseBrowserRuntime } from '../../src/lib/supabaseClient';

type Scale = 'month' | 'year';
type Page = 'calendar' | 'invite' | 'plans' | 'me';
type DateMark = 'confirmed' | 'pending' | 'him' | 'her' | 'memory';

type CalendarMark = {
  label: string;
  marks: DateMark[];
  primary?: DateMark;
};

type Arrangement = {
  activity: string;
  location: string;
};

type LocalInvitation = {
  id: string;
  date: string;
  time: string;
  activities: string[];
  location: string;
  note: string;
};

type RecordType = 'plans' | 'notes' | 'photos';
type RecordPerson = 'mine' | 'partner';
type RecordItem = {
  date: string;
  title: string;
  detail?: string;
  status?: string;
};
const recordsData: RecordsViewModel = {
  plans: [
    { date: '2026-09-24', title: '去看展览', detail: '晚上 · 地点待补充', status: '已确定' },
    { date: '2026-09-18', title: '周末散步', detail: '下午 · 城市公园', status: '等待确认' },
    { date: '2026-09-09', title: '一起吃晚餐', detail: '晚上 · 小街餐厅', status: '已完成' },
    { date: '2026-08-30', title: '逛独立书店', detail: '下午 · 北街书店', status: '已完成' },
    { date: '2026-08-16', title: '河边野餐', detail: '上午 · 河畔公园', status: '已完成' },
    { date: '2026-07-20', title: '看一场电影', detail: '晚上 · 影院', status: '已完成' },
  ],
  notes: {
    mine: [
      { date: '2026-09-09', title: '今天的晚餐很舒服，回家的路上还在聊下次想一起去哪里。' },
      { date: '2026-09-03', title: '把想一起做的事情写在这里，慢慢安排。' },
      { date: '2026-08-28', title: '平常的一天，因为一起散步变得很特别。' },
    ],
    partner: [
      { date: '2026-09-09', title: '今天的晚餐很舒服，回家的路上还在聊下次想一起去哪里。' },
      { date: '2026-08-21', title: '想把最近的小开心也认真记下来。' },
    ],
  },
  photos: {
    mine: [
      { date: '2026-09-09', title: '晚餐后的夜色' },
      { date: '2026-09-03', title: '路边的小花' },
      { date: '2026-08-30', title: '书店一角' },
      { date: '2026-08-16', title: '河边的午后' },
      { date: '2026-08-02', title: '一起做的早餐' },
      { date: '2026-07-20', title: '电影票根' },
      { date: '2026-07-12', title: '回家路上的天空' },
      { date: '2026-06-28', title: '第一次去的咖啡馆' },
    ],
    partner: [
      { date: '2026-09-09', title: '晚餐的甜点' },
      { date: '2026-08-30', title: '书架上的新书' },
      { date: '2026-08-16', title: '野餐篮' },
    ],
  },
};

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const marks: Record<string, ViewCalendarMark> = {
  '2026-09-02': { label: '', marks: ['him'] },
  '2026-09-03': { label: '她有空', marks: ['her'] },
  '2026-09-09': { label: '晚餐 · 已确定', marks: ['memory'], primary: 'confirmed' },
  '2026-09-08': { label: '', marks: ['pending'] },
  '2026-09-12': { label: '', marks: ['him', 'her'] },
  '2026-09-18': { label: '', marks: ['pending'], primary: 'pending' },
  '2026-09-24': { label: '', marks: ['memory'] },
};

const upcoming = [
  { date: '9月9日 · 星期三', title: '一起吃晚餐', meta: '晚上 · 已确定', key: '2026-09-09' },
  { date: '9月18日 · 星期五', title: '周末计划等待确认', meta: '需要你处理', key: '2026-09-18' },
  { date: '9月24日 · 星期四', title: '去看展览', meta: '有文字和照片记录', key: '2026-09-24' },
];

const prototypePlanItems = [
  { date: '9月18日 · 星期五 · 晚上', title: '周末计划', meta: '地点还没有填写 · 林林发来的邀请', status: '等待你的回应', tone: 'pending' as const, key: 'prototype-pending', dateKey: '2026-09-18' },
  { date: '9月9日 · 星期三 · 晚上', title: '一起吃晚餐', meta: '南山书店附近 · 和林林', status: '已确定', tone: 'confirmed' as const, key: 'prototype-confirmed', dateKey: '2026-09-09' },
  { date: '9月24日 · 星期四 · 下午', title: '去看展览', meta: '地点待补充 · 留下了文字和照片', status: '有回忆', tone: 'memory' as const, key: 'prototype-memory', dateKey: '2026-09-24' },
  { date: '9月1日 · 星期二 · 下午', title: '咖啡见面', meta: '南山书店附近 · 这次见面已经结束', status: '已结束', tone: 'expired' as const, key: 'prototype-expired', dateKey: '2026-09-01' },
  { date: '8月28日 · 星期五 · 晚上', title: '周末散步', meta: '临时调整了时间 · 这份邀请没有继续', status: '已取消', tone: 'cancelled' as const, key: 'prototype-cancelled', dateKey: '2026-08-28' },
];

const detailData: Record<string, {
  status: string;
  title: string;
  mineTime: string;
  partnerTime: string;
  activity: string;
  location: string;
  note?: string;
  partnerNote?: string;
  photos?: string[];
}> = {
  '2026-09-09': {
    status: '已确定 · 一起吃晚餐',
    title: '一起吃晚餐',
    mineTime: '晚上',
    partnerTime: '晚上',
    activity: '晚餐',
    location: '未填写',
    note: '今天的晚餐很舒服，回家的路上还在聊下次想一起去哪里。',
    partnerNote: '今天的晚餐很舒服，回家的路上还在聊下次想一起去哪里。',
    photos: ['晚餐后的夜色'],
  },
  '2026-09-18': {
    status: '需要处理 · 周末计划',
    title: '周末计划',
    mineTime: '晚上',
    partnerTime: '待确认',
    activity: '周末计划',
    location: '未填写',
  },
  '2026-09-24': {
    status: '有回忆',
    title: '去看展览',
    mineTime: '未填写',
    partnerTime: '未填写',
    activity: '尚未创建安排',
    location: '未填写',
  },
};

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatInviteDateTime(date: string, time: string) {
  if (!date) return '未填写';
  const dateObject = new Date(`${date}T00:00:00`);
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${dateObject.getMonth() + 1}月${dateObject.getDate()}日 · 星期${weekdayNames[dateObject.getDay()]}${time ? ` · ${time}` : ''}`;
}

const periodLabels: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
  all_day: '全天',
};

function formatPeriods(periods: string[]) {
  return periods.map((period) => periodLabels[period] ?? period).join('、') || '未填写';
}

function periodFromLabel(label: string) {
  return {
    上午: 'morning',
    下午: 'afternoon',
    晚上: 'evening',
  }[label] as 'morning' | 'afternoon' | 'evening' | undefined;
}

function periodFromTime(time: string) {
  const hour = Number(time.slice(0, 2));
  if (!Number.isFinite(hour)) return undefined;
  if (hour < 12) return 'morning' as const;
  if (hour < 18) return 'afternoon' as const;
  return 'evening' as const;
}

function formatShortDate(date: string, includeTime = false, periods: string[] = []) {
  const dateObject = new Date(`${date}T00:00:00`);
  if (Number.isNaN(dateObject.getTime())) return date;
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${dateObject.getMonth() + 1}月${dateObject.getDate()}日 · 星期${weekdayNames[dateObject.getDay()]}${includeTime ? ` · ${formatPeriods(periods)}` : ''}`;
}

function invitationTitle(activity: string[]) {
  return activity.join('、') || '见面安排';
}

function invitationStatusLabel(status: string) {
  return {
    pending: '等待确认',
    adjustment_pending: '等待调整',
    confirmed: '已确定',
    rejected: '已拒绝',
    cancelled: '已取消',
  }[status] ?? status;
}

function invitationTone(status: string): 'pending' | 'confirmed' | 'cancelled' {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled' || status === 'rejected') return 'cancelled';
  return 'pending';
}

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const previousCount = new Date(year, month, 0).getDate();
  const cellCount = Math.ceil((start + count) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const dayIndex = index - start + 1;
    if (dayIndex < 1) return { day: previousCount + dayIndex, muted: true, date: formatDate(year, month - 1, previousCount + dayIndex) };
    if (dayIndex > count) return { day: dayIndex - count, muted: true, date: formatDate(year, month + 1, dayIndex - count) };
    return { day: dayIndex, muted: false, date: formatDate(year, month, dayIndex) };
  });
}

function Icon({ name }: { name: 'calendar' | 'invite' | 'plans' | 'me' | 'bell' | 'clock' | 'arrow-left' | 'arrow-right' | 'edit' | 'check' | 'photo' }) {
  const paths = {
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3.5v3M17 3.5v3M3.5 9h17" /></>,
    invite: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z" /><path d="m7 8 5 4 5-4" /></>,
    plans: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    me: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    bell: <><path d="M6 10a6 6 0 0 1 12 0c0 6 2 6 2 7H4c0-1 2-1 2-7M10 20h4" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    'arrow-left': <path d="m14 6-6 6 6 6" />,
    'arrow-right': <path d="m10 6 6 6-6 6" />,
    edit: <><path d="M5 19 6.4 14.2 16.8 3.8a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L9.2 17Z" /><path d="m14.8 5.8 3.4 3.4M5 19h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    photo: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.3" /><path d="m5.5 16 4.1-4 2.8-2 4.1 3.3" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

type AuthView = 'login' | 'register';

function EyeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.2" /></svg>;
}

function PasswordField({ id, label, value, onChange, placeholder, autocomplete }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autocomplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <input
          className="auth-input auth-password-input"
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autocomplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="auth-password-toggle"
          type="button"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon />
        </button>
      </div>
    </>
  );
}

function BrandIllustration({ view }: { view: AuthView }) {
  if (view === 'register') {
    return (
      <div className="auth-illustration auth-memory-illustration" aria-label="两个人共同创建回忆空间的插画">
        <div className="auth-memory-card auth-memory-card-first">
          <strong>我们的小空间</strong>
          <p>给每一个约定留一个位置，也给每一次见面留下一点痕迹。</p>
          <div className="auth-memory-line">一起收藏今天</div>
        </div>
        <div className="auth-memory-card auth-memory-card-second">
          <strong>第一篇记录</strong>
          <p>从一句话、一张照片，或者一个还没实现的约定开始。</p>
          <div className="auth-memory-line mint">准备好了</div>
        </div>
        <div className="auth-note auth-note-date">从今天开始</div>
        <div className="auth-note auth-note-memory">把日子收好</div>
        <div className="auth-heart" aria-hidden="true">♥</div>
      </div>
    );
  }
  return (
    <div className="auth-illustration auth-calendar-illustration" aria-label="两个人共同记录日期与回忆的插画">
      <div className="auth-calendar-card auth-calendar-card-first">
        <div className="auth-calendar-top"><strong>这个月</strong><span>六月</span></div>
        <div className="auth-calendar-grid" aria-hidden="true">
          <i>一</i><i>二</i><i>三</i><i>四</i><i>五</i><i>六</i><i>日</i>
          <i /><i /><i>1</i><i>2</i><i>3</i><i className="marked">4</i><i>5</i>
          <i>6</i><i>7</i><i>8</i><i className="mint-mark">9</i><i>10</i><i>11</i><i>12</i>
          <i>13</i><i>14</i><i>15</i><i>16</i><i>17</i><i>18</i><i className="blue-mark">19</i>
        </div>
      </div>
      <div className="auth-calendar-card auth-calendar-card-second">
        <div className="auth-calendar-top"><strong>我们的记录</strong><span>3 条</span></div>
        <div className="auth-calendar-grid" aria-hidden="true">
          <i>散步</i><i>晚餐</i><i>电影</i><i>生日</i><i className="mint-mark">晴天</i><i>照片</i><i className="marked">约定</i>
        </div>
      </div>
      <div className="auth-connection-line" aria-hidden="true" />
      <div className="auth-note auth-note-date">下个周末见</div>
      <div className="auth-note auth-note-memory">那天的晚霞</div>
      <div className="auth-heart" aria-hidden="true">♥</div>
    </div>
  );
}

function AuthScreen({ view, onViewChange, onLoginSuccess }: {
  view: AuthView;
  onViewChange: (view: AuthView) => void;
  onLoginSuccess: () => void;
}) {
  const [loginValues, setLoginValues] = useState({ email: '', password: '' });
  const [registerValues, setRegisterValues] = useState({ name: '', email: '', password: '', confirmPassword: '', agreement: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const clearField = (field: string) => {
    setErrors((current) => ({ ...current, [field]: '' }));
    setFeedback('');
    setFeedbackError(false);
  };
  const switchView = (nextView: AuthView) => {
    setErrors({});
    setFeedback('');
    setFeedbackError(false);
    onViewChange(nextView);
    window.scrollTo(0, 0);
  };
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!loginValues.email.trim()) nextErrors.email = '请输入邮箱地址';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginValues.email.trim())) nextErrors.email = '请输入有效的邮箱地址';
    if (!loginValues.password) nextErrors.password = '请输入密码';
    else if (loginValues.password.length < 8) nextErrors.password = '密码至少需要 8 位字符';
    setErrors(nextErrors);
    setFeedback('');
    setFeedbackError(false);
    if (Object.keys(nextErrors).length > 0) return;

    setLoginPending(true);
    try {
      const { client } = getSupabaseBrowserRuntime();
      const { error } = await client.auth.signInWithPassword({
        email: loginValues.email.trim(),
        password: loginValues.password,
      });
      if (error) {
        setFeedback('邮箱或密码错误');
        setFeedbackError(true);
        return;
      }
      onLoginSuccess();
    } catch {
      setFeedback('邮箱或密码错误');
      setFeedbackError(true);
    } finally {
      setLoginPending(false);
    }
  };
  const submitRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!registerValues.name.trim()) nextErrors.name = '请输入昵称';
    if (!registerValues.email.trim()) nextErrors.email = '请输入邮箱地址';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerValues.email.trim())) nextErrors.email = '请输入有效的邮箱地址';
    if (registerValues.password.length < 8) nextErrors.password = '密码至少需要 8 位字符';
    if (!registerValues.confirmPassword) nextErrors.confirmPassword = '请再次输入密码';
    else if (registerValues.confirmPassword !== registerValues.password) nextErrors.confirmPassword = '两次输入的密码不一致';
    setErrors(nextErrors);
    if (!registerValues.agreement) {
      setFeedback('请先同意隐私说明与使用说明');
      setFeedbackError(true);
    } else {
      setFeedback(nextErrors.name || nextErrors.email || nextErrors.password || nextErrors.confirmPassword ? '' : '空间创建信息已确认。');
      setFeedbackError(false);
    }
  };
  const loginUpdate = (key: 'email' | 'password', value: string) => {
    setLoginValues((current) => ({ ...current, [key]: value }));
    clearField(key);
  };
  const registerUpdate = (key: 'name' | 'email' | 'password' | 'confirmPassword', value: string) => {
    setRegisterValues((current) => ({ ...current, [key]: value }));
    clearField(key);
  };
  const login = view === 'login';
  return (
    <main className="auth-page">
      <section className="auth-brand-side" aria-labelledby="auth-brand-heading">
        <div className="auth-brand-content">
          <a className="auth-brand" href="#login" aria-label="留一页给我们">
            <span className="auth-brand-mark">页</span><span>留一页给我们</span>
          </a>
          <div className="auth-brand-copy">
            <h1 id="auth-brand-heading">{login ? '把今天，留给我们。' : '从这一页，开始记录。'}</h1>
            <p>{login ? '登录后，继续记录你们正在一起经历的日子。' : '创建你们的专属空间，把值得记住的日子慢慢收好。'}</p>
          </div>
          <BrandIllustration view={view} />
        </div>
      </section>
      <section className="auth-form-side" aria-labelledby="auth-form-heading">
        <div className={`auth-panel ${login ? 'auth-login-panel' : 'auth-register-panel'}`}>
          <h2 id="auth-form-heading">{login ? '欢迎回来' : '创建空间'}</h2>
          <p className="auth-panel-copy">{login ? '继续进入你们的专属空间' : '注册后，开始记录你们的故事'}</p>
          {login ? (
            <form className="auth-form" onSubmit={submitLogin} noValidate>
              <div className="auth-field"><label htmlFor="auth-login-email">邮箱</label><input className="auth-input" id="auth-login-email" type="email" autoComplete="email" placeholder="请输入邮箱地址" value={loginValues.email} onChange={(event) => loginUpdate('email', event.target.value)} /><p className="auth-field-error">{errors.email}</p></div>
              <div className="auth-field"><PasswordField id="auth-login-password" label="密码" value={loginValues.password} onChange={(value) => loginUpdate('password', value)} placeholder="请输入密码" autocomplete="current-password" /><p className="auth-field-error">{errors.password}</p></div>
              <div className="auth-form-row"><button className="auth-text-link" type="button" onClick={() => { setFeedback('找回密码功能暂未开放。'); setFeedbackError(false); }}>忘记密码？</button></div>
              <button className="auth-primary-button" type="submit" disabled={loginPending}>{loginPending ? '登录中…' : '登录'}</button>
              <p className={`auth-feedback ${feedbackError ? 'error' : ''}`}>{feedback}</p>
            </form>
          ) : (
            <form className="auth-form auth-register-form" onSubmit={submitRegister} noValidate>
              <div className="auth-field"><label htmlFor="auth-register-name">怎么称呼你</label><input className="auth-input" id="auth-register-name" type="text" autoComplete="name" placeholder="请输入昵称" value={registerValues.name} onChange={(event) => registerUpdate('name', event.target.value)} /><p className="auth-field-error">{errors.name}</p></div>
              <div className="auth-field"><label htmlFor="auth-register-email">邮箱</label><input className="auth-input" id="auth-register-email" type="email" autoComplete="email" placeholder="请输入邮箱地址" value={registerValues.email} onChange={(event) => registerUpdate('email', event.target.value)} /><p className="auth-field-error">{errors.email}</p></div>
              <div className="auth-field"><PasswordField id="auth-register-password" label="设置密码" value={registerValues.password} onChange={(value) => registerUpdate('password', value)} placeholder="至少 8 位字符" autocomplete="new-password" /><p className="auth-field-error">{errors.password}</p></div>
              <div className="auth-field"><PasswordField id="auth-register-confirm-password" label="确认密码" value={registerValues.confirmPassword} onChange={(value) => registerUpdate('confirmPassword', value)} placeholder="请再次输入密码" autocomplete="new-password" /><p className="auth-field-error">{errors.confirmPassword}</p></div>
              <label className="auth-agreement"><input type="checkbox" checked={registerValues.agreement} onChange={(event) => { setRegisterValues((current) => ({ ...current, agreement: event.target.checked })); setFeedback(''); setFeedbackError(false); }} /><span>我已阅读并同意<a href="#privacy">隐私说明</a>与<a href="#terms">使用说明</a></span></label>
              <button className="auth-primary-button" type="submit">创建空间</button>
              <p className={`auth-feedback ${feedbackError ? 'error' : ''}`}>{feedback}</p>
            </form>
          )}
          {login ? <p className="auth-switch-copy">还没有账号？ <button className="auth-text-link" type="button" onClick={() => switchView('register')}>注册</button></p> : <p className="auth-switch-copy">已经有账号？ <button className="auth-text-link" type="button" onClick={() => switchView('login')}>返回登录</button></p>}
          {login && <p className="auth-privacy-note">你的记录只属于你们。继续登录即表示同意<a href="#privacy">隐私说明</a>。</p>}
        </div>
      </section>
    </main>
  );
}

function WorkspaceApp() {
  const [scale, setScale] = usePersistentState<Scale>('calendar-scale', 'month');
  const [page, setPage] = useState<Page>('calendar');
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date(2026, 8, 1));
  const [selectedDate, setSelectedDate] = useState('2026-09-09');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [recordView, setRecordView] = useState<'mine' | 'partner'>('mine');
  const [availability, setAvailability] = useState<string[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = usePersistentState<Record<string, string>>('availability', {});
  const [availabilityEditorOpen, setAvailabilityEditorOpen] = useState(false);
  const [availabilityFeedback, setAvailabilityFeedback] = useState('');
  const [responseFeedback, setResponseFeedback] = useState('');
  const [arrangementEditorOpen, setArrangementEditorOpen] = useState(false);
  const [arrangementDraft, setArrangementDraft] = useState<Arrangement>({ activity: '', location: '' });
  const [arrangements, setArrangements] = usePersistentState<Record<string, Arrangement>>('arrangements', {});
  const [arrangementFeedback, setArrangementFeedback] = useState('');
  const [localInvitations, setLocalInvitations] = usePersistentState<LocalInvitation[]>('local-invitations', []);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [notes, setNotes] = usePersistentState<Record<string, string>>('notes', {});
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoFeedback, setPhotoFeedback] = useState('');
  const [photos, setPhotos] = usePersistentState<Record<string, string[]>>('photos', {});
  const [cloudPhotosByDate, setCloudPhotosByDate] = useState<Record<string, string[]>>({});
  const [cloudPhotosLoaded, setCloudPhotosLoaded] = useState<Record<string, boolean>>({});
  const [noticePreferences, setNoticePreferences] = usePersistentState('notice-preferences', { invite: true, changes: true });
  const [meFeedback, setMeFeedback] = useState('');
  const [mePanel, setMePanel] = useState<'profile' | 'space' | null>(null);
  const [inviteSubmitted, setInviteSubmitted] = usePersistentState('invite-submitted', false);
  const [inviteDraft, setInviteDraft] = usePersistentState('invite-draft', { date: '', time: '', activities: [] as string[], otherActivity: '', location: '', note: '' });
  const [inviteFeedback, setInviteFeedback] = useState('');
  const { state: cloud, refresh: refreshCloud } = useCloudSnapshot();
  const cloudRepository = cloud.status === 'ready' ? cloud.repository : undefined;
  const hydratedViewPreference = useRef<string | null>(null);
  useEffect(() => {
    if (cloud.status !== 'ready' || hydratedViewPreference.current === cloud.identity) return;
    hydratedViewPreference.current = cloud.identity;
    setScale(cloud.snapshot.viewPreference === 'month' ? 'month' : 'year');
  }, [cloud, setScale]);
  const changeScale = (nextScale: Scale) => {
    setScale(nextScale);
    if (cloudRepository) {
      void cloudRepository.saveViewPreference(nextScale).catch(() => undefined);
    }
  };
  const cloudAvailability = useMemo(() => {
    if (cloud.status !== 'ready') return {};
    return cloud.snapshot.availability
      .filter((item) => item.ownerId === cloud.identity)
      .reduce<Record<string, string>>((result, item) => {
        result[item.date] = item.periods.map((period) => ({ morning: '上午', afternoon: '下午', evening: '晚上', all_day: '全天' }[period] ?? period)).join('、');
        return result;
      }, {});
  }, [cloud]);
  const cloudNotes = useMemo(() => {
    if (cloud.status !== 'ready') return {};
    return cloud.snapshot.dailyNotes
      .filter((item) => item.ownerId === cloud.identity)
      .reduce<Record<string, string>>((result, item) => {
        result[item.date] = item.body || item.title;
        return result;
      }, {});
  }, [cloud]);
  const mergedAvailability = useMemo(() => ({ ...cloudAvailability, ...availabilityByDate }), [availabilityByDate, cloudAvailability]);
  const mergedNotes = useMemo(() => ({ ...cloudNotes, ...notes }), [cloudNotes, notes]);
  const cloudInvitations = useMemo(() => cloud.status === 'ready' ? cloud.snapshot.invitations : [], [cloud]);
  const localOnlyInvitations = useMemo(
    () => localInvitations.filter((item) => !cloudInvitations.some((invitation) => invitation.date === item.date)),
    [cloudInvitations, localInvitations],
  );
  const cloudRecords = useMemo<RecordsViewModel>(() => {
    if (cloud.status !== 'ready') return recordsData;
    const plans = cloudInvitations.map((item) => ({
      date: item.date,
      title: invitationTitle(item.activity),
      detail: formatPeriods(item.periods),
      status: invitationStatusLabel(item.status),
    }));
    const mine = cloud.snapshot.dailyNotes.filter((item) => item.ownerId === cloud.identity).map((item) => ({ date: item.date, title: item.body || item.title }));
    const partner = cloud.snapshot.dailyNotes.filter((item) => item.ownerId !== cloud.identity).map((item) => ({ date: item.date, title: item.body || item.title }));
    return {
      plans,
      notes: { mine, partner },
      photos: { mine: [], partner: [] },
    };
  }, [cloud, cloudInvitations]);
  const viewMarks = useMemo(() => {
    const result = createCalendarMarks(marks, arrangements, mergedAvailability, mergedNotes, photos);
    cloudInvitations.forEach((item) => {
      const primary: DateMark = item.status === 'confirmed'
        ? 'confirmed'
        : item.status === 'pending' || item.status === 'adjustment_pending' ? 'pending' : 'memory';
      result[item.date] = {
        ...result[item.date],
        label: `${invitationTitle(item.activity)} · ${invitationStatusLabel(item.status)}`,
        marks: Array.from(new Set([...(result[item.date]?.marks ?? []), primary])),
        primary,
      };
    });
    localOnlyInvitations.forEach((item) => {
      const current = result[item.date];
      result[item.date] = {
        ...current,
        label: [current?.label, `${invitationTitle(item.activities)} · 等待确认`].filter(Boolean).join(' · '),
        marks: Array.from(new Set([...(current?.marks ?? []), 'pending' as const])),
        primary: current?.primary ?? 'pending',
      };
    });
    return result;
  }, [arrangements, cloud.status, cloudInvitations, localOnlyInvitations, mergedAvailability, mergedNotes, photos]);
  const liveUpcoming = useMemo(() => cloudInvitations
    .filter((item) => item.status !== 'rejected' && item.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: formatShortDate(item.date),
      title: invitationTitle(item.activity),
      meta: `${formatPeriods(item.periods)} · ${invitationStatusLabel(item.status)}`,
      key: item.id,
      dateKey: item.date,
    })), [cloudInvitations]);
  const localUpcoming = useMemo(() => localOnlyInvitations
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: formatShortDate(item.date),
      title: invitationTitle(item.activities),
      meta: `${item.time} · 等待确认`,
      key: item.id,
      dateKey: item.date,
    })), [localOnlyInvitations]);
  const planItems = useMemo(() => [
    ...cloudInvitations.map((item) => ({
      date: formatShortDate(item.date, true, item.periods),
      title: invitationTitle(item.activity),
      meta: item.note || '地点待补充',
      status: invitationStatusLabel(item.status),
      tone: invitationTone(item.status),
      key: item.id,
      dateKey: item.date,
    })),
    ...localOnlyInvitations.map((item) => ({
      date: formatShortDate(item.date, true, [periodFromTime(item.time) ?? '']),
      title: invitationTitle(item.activities),
      meta: item.location || '地点待补充',
      status: '等待确认',
      tone: 'pending' as const,
      key: item.id,
      dateKey: item.date,
    })),
  ], [cloudInvitations, localOnlyInvitations]);
  const displayedPlanItems = useMemo(
    () => planItems.length > 0 || cloud.status === 'ready' ? planItems : prototypePlanItems,
    [cloud.status, planItems],
  );
  const viewRecords = useMemo(() => createRecordsViewModel(cloudRecords, arrangements, notes, photos), [arrangements, cloudRecords, notes, photos]);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const now = new Date();
  const todayDate = formatDate(now.getFullYear(), now.getMonth(), now.getDate());
  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const moveMonth = (offset: number) => {
    setAnchor((value) => new Date(value.getFullYear(), value.getMonth() + offset, 1));
  };
  const selectedDetail = detailData[selectedDate] ?? {
    status: '还没有安排',
    title: '这一天还没有安排',
    mineTime: '未填写',
    partnerTime: '未填写',
    activity: '尚未创建安排',
    location: '未填写',
    note: '',
    partnerNote: '',
    photos: [],
  };
  const selectedInvitation = cloudInvitations.find((item) => item.date === selectedDate);
  const selectedLocalInvitation = localOnlyInvitations.find((item) => item.date === selectedDate);
  const selectedFallbackPending = !selectedInvitation && !selectedLocalInvitation
    && selectedDetail.status.startsWith('需要处理');
  const selectedPartnerAvailability = cloud.status === 'ready'
    ? cloud.snapshot.availability.find((item) => item.date === selectedDate && item.ownerId !== cloud.identity)
    : undefined;
  const selectedArrangement = arrangements[selectedDate] ?? {
    activity: selectedInvitation
      ? invitationTitle(selectedInvitation.activity)
      : selectedLocalInvitation
        ? invitationTitle(selectedLocalInvitation.activities)
        : selectedDetail.activity,
    location: selectedLocalInvitation?.location || selectedDetail.location,
  };
  const selectedAvailability = mergedAvailability[selectedDate] ?? selectedDetail.mineTime;
  const selectedNote = mergedNotes[selectedDate] ?? selectedDetail.note;
  const selectedPartnerNote = cloud.status === 'ready'
    ? cloud.snapshot.dailyNotes.find((item) => item.date === selectedDate && item.ownerId !== cloud.identity)?.body
    : selectedDetail.partnerNote;
  const selectedPhotos = cloudPhotosLoaded[selectedDate]
    ? cloudPhotosByDate[selectedDate] ?? []
    : photos[selectedDate] ?? selectedDetail.photos ?? [];
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedDateLabel = `${selectedDateObject.getMonth() + 1}月${selectedDateObject.getDate()}日 · 星期${['日', '一', '二', '三', '四', '五', '六'][selectedDateObject.getDay()]}`;

  useEffect(() => {
    if (cloud.status !== 'ready') return;
    let active = true;
    setCloudPhotosLoaded((value) => ({ ...value, [selectedDate]: false }));
    void cloud.photoRepository.list(selectedDate).then((items) => {
      if (!active) return;
      setCloudPhotosByDate((value) => ({
        ...value,
        [selectedDate]: items.map((item) => item.url ?? item.thumbnailUrl ?? item.title).filter(Boolean),
      }));
      setCloudPhotosLoaded((value) => ({ ...value, [selectedDate]: true }));
    }).catch(() => {
      if (active) setPhotoFeedback('照片暂时无法读取，请稍后重试');
    });
    return () => { active = false; };
  }, [cloud, selectedDate]);

  const openDetail = (date: string) => {
    setSelectedDate(date);
    setRecordView('mine');
    setAvailability([]);
    setAvailabilityEditorOpen(false);
    setAvailabilityFeedback('');
    setResponseFeedback('');
    setArrangementEditorOpen(false);
    setArrangementFeedback('');
    setNoteEditorOpen(false);
    setNoteDraft(mergedNotes[date] ?? detailData[date]?.note ?? '');
    setPhotoEditorOpen(false);
    setPhotoDraft([]);
    setPhotoFiles([]);
    setPhotoFeedback('');
    setDetailOpen(true);
  };
  const closeDetail = () => setDetailOpen(false);
  const respondToSelectedInvitation = async (response: InvitationResponse) => {
    const accepted = response.type === 'confirm' || response.type === 'accept-adjustment';
    if (!selectedInvitation) {
      setResponseFeedback(accepted
        ? '已接受安排，之后还可以继续调整。'
        : '已保留这份邀请，你可以稍后再决定。');
      return;
    }
    if (!cloudRepository) {
      setResponseFeedback(response.type === 'confirm' || response.type === 'accept-adjustment'
        ? '已接受安排，之后还可以继续调整。'
        : '已保留这份邀请，你可以稍后再决定。');
      return;
    }
    try {
      await cloudRepository.respondToInvitation(selectedInvitation.id, response);
      await refreshCloud();
      setResponseFeedback(response.type === 'confirm' || response.type === 'accept-adjustment'
        ? '已接受安排，之后还可以继续调整。'
        : '已完成处理');
    } catch (error) {
      setResponseFeedback(error instanceof Error ? error.message : '邀请处理失败，请稍后重试');
    }
  };
  const openNotification = async (notificationId: string, date: string) => {
    if (cloudRepository) {
      try {
        await cloudRepository.markNotificationRead(notificationId);
        await refreshCloud();
      } catch {
        // Opening the related date should still work when read-state sync fails.
      }
    }
    openDetail(date);
    setNoticeOpen(false);
  };
  const savePhotos = async () => {
      if (photoFiles.length === 0) return;
      setPhotoFeedback('');
      if (cloud.status === 'ready') {
        try {
          const uploaded: PhotoRecord[] = [];
          for (const file of photoFiles) {
            uploaded.push(await cloud.photoRepository.add({
              date: selectedDate,
              blob: file,
              fileName: file.name,
              title: file.name,
            }));
          }
          setCloudPhotosByDate((value) => ({
            ...value,
            [selectedDate]: [
              ...(value[selectedDate] ?? selectedPhotos),
              ...uploaded.map((item) => item.url ?? item.thumbnailUrl).filter((url): url is string => Boolean(url)),
            ],
          }));
          setCloudPhotosLoaded((value) => ({ ...value, [selectedDate]: true }));
          setPhotoEditorOpen(false);
          setPhotoDraft([]);
          setPhotoFiles([]);
        } catch (error) {
          setPhotoFeedback(error instanceof Error ? error.message : '照片上传失败，请重试');
        }
        return;
      }
      setPhotos((value) => ({
        ...value,
        [selectedDate]: [...(value[selectedDate] ?? selectedPhotos), ...photoDraft],
      }));
      setPhotoEditorOpen(false);
      setPhotoDraft([]);
      setPhotoFiles([]);
    };
  const goTo = (nextPage: Page) => {
    setPage(nextPage);
    setDetailOpen(false);
    setNoticeOpen(false);
  };
  const submitInvite = async () => {
    setInviteFeedback('');
    const period = periodFromTime(inviteDraft.time);
    const activities = inviteDraft.activities
      .map((activity) => activity === '其他' ? inviteDraft.otherActivity.trim() : activity)
      .filter(Boolean);
    if (!inviteDraft.date || !period || activities.length === 0) {
      setInviteFeedback('请填写日期、时间并至少选择一项活动。');
      return;
    }
    if (!cloudRepository) {
      setLocalInvitations((items) => [...items, { ...inviteDraft, id: crypto.randomUUID() }]);
      setInviteSubmitted(true);
      return;
    }
    try {
      await cloudRepository.createInvitation({
        date: inviteDraft.date,
        periods: [period],
        activities,
        note: inviteDraft.note.trim(),
      });
      await refreshCloud();
      setInviteSubmitted(true);
    } catch {
      setInviteFeedback('云端保存失败，请检查网络后重试。');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#calendar" aria-label="返回首页"><span className="brand-mark">页</span><span>留一页给我们</span></a>
        <nav className="sidebar-nav" aria-label="主要导航">
          <NavItem icon="calendar" label="日历" active={page === 'calendar'} onClick={() => goTo('calendar')} />
          <NavItem icon="invite" label="邀请" active={page === 'invite'} onClick={() => goTo('invite')} />
          <NavItem icon="plans" label="安排" active={page === 'plans'} onClick={() => goTo('plans')} />
          <NavItem icon="me" label="我的" active={page === 'me'} onClick={() => goTo('me')} />
        </nav>
        <p className="sidebar-note">把时间留给我们，也把已经发生的好事留在这里。</p>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <a className="mobile-brand brand" href="#calendar" aria-label="返回首页"><span className="brand-mark">页</span><span>留一页给我们</span></a>
          <button className="notification-button" type="button" aria-label="打开提醒" onClick={() => setNoticeOpen((value) => !value)}>
            <Icon name="bell" />
            <i className="notification-dot" />
          </button>
        </header>

        {noticeOpen && (
          <div className="notice-backdrop" onClick={() => setNoticeOpen(false)}>
            <aside className="notice-panel" role="dialog" aria-label="提醒" onClick={(event) => event.stopPropagation()}>
              <header><strong>提醒</strong><button type="button" aria-label="关闭提醒" onClick={() => setNoticeOpen(false)}>×</button></header>
              {(cloud.status === 'ready' ? cloud.snapshot.notifications.filter((item) => !item.readAt) : [
                { id: 'sample-pending', invitationId: 'sample-pending', kind: 'created', createdAt: '', readAt: null },
                { id: 'sample-confirmed', invitationId: 'sample-confirmed', kind: 'confirmed', createdAt: '', readAt: null },
              ]).map((notification) => {
                const invitation = cloudInvitations.find((item) => item.id === notification.invitationId);
                const fallbackDate = notification.id === 'sample-pending' ? '2026-09-18' : '2026-09-09';
                const date = invitation?.date ?? fallbackDate;
                const title = invitation ? invitationTitle(invitation.activity) : notification.id === 'sample-pending' ? '周末计划' : '一起吃晚餐';
                const headline = notification.kind === 'confirmed' ? '你们的安排已经确定' : notification.kind === 'rejected' ? '这份邀请没有继续' : '有一项安排需要你处理';
                return <button type="button" className="notice-item" key={notification.id} onClick={() => void openNotification(notification.id, date)}>
                  <strong>{headline}</strong><span>{formatShortDate(date)} · {title}</span>
                </button>;
              })}
              {cloud.status === 'ready' && cloud.snapshot.notifications.filter((item) => !item.readAt).length === 0 && <p className="notice-empty">暂时没有新的提醒</p>}
            </aside>
          </div>
        )}

        {page === 'calendar' && <main className="workspace" id="calendar">
          <header className="workspace-heading">
            <div>
              <p className="eyebrow">你们的共享空间</p>
              <h1>把时间留给我们</h1>
              <p className="workspace-copy">一起安排下一次见面，也记下已经发生的好事。</p>
            </div>
            <span className="connection-status"><i />共享空间已连接</span>
          </header>

          <div className="workspace-grid">
            <section className="calendar-section" aria-label="共享月历">
              <header className="calendar-toolbar">
                <div className="month-title">
                  <button className="icon-button" type="button" aria-label="上个月" onClick={() => moveMonth(-1)}>‹</button>
                  <div>
                    <strong>{year}年{month + 1}月</strong>
                    <small>选择一天查看安排与回忆</small>
                  </div>
                  <button className="icon-button" type="button" aria-label="下个月" onClick={() => moveMonth(1)}>›</button>
                </div>
                <div className="scale-buttons" role="group" aria-label="日历尺度">
                  <button className={scale === 'month' ? 'active' : ''} type="button" onClick={() => changeScale('month')}>月</button>
                  <button className={scale === 'year' ? 'active' : ''} type="button" onClick={() => changeScale('year')}>年</button>
                </div>
              </header>

              <div className={`legend ${legendOpen ? 'expanded' : ''}`} aria-label="日历图例">
                <button className="legend-toggle" type="button" aria-expanded={legendOpen} aria-controls="legend-items" onClick={() => setLegendOpen((value) => !value)}>查看状态说明</button>
                <div className="legend-items" id="legend-items">
                  <LegendMark kind="confirmed" label="已确定" />
                  <LegendMark kind="pending" label="需要处理" />
                  <LegendMark kind="him" label="他有空" />
                  <LegendMark kind="her" label="她有空" />
                  <LegendMark kind="memory" label="有回忆" />
                </div>
              </div>

              {scale === 'month' ? (
                <>
                  <div className="calendar-grid">
                    {weekdays.map((weekday) => <span className="weekday" key={weekday}>{weekday}</span>)}
                    {days.map((item) => {
                      const mark = viewMarks[item.date];
                      return (
                        <button
                          className={`day ${item.muted ? 'muted' : ''} ${selectedDate === item.date ? 'selected' : ''} ${todayDate === item.date ? 'today' : ''} ${mark?.primary ?? ''}`}
                          type="button"
                          key={item.date}
                          disabled={item.muted}
                          onClick={() => openDetail(item.date)}
                        >
                          <strong>{item.day}</strong>
                          {(mark?.label || todayDate === item.date) && <small>{mark?.label || '今天'}</small>}
                          {mark && <span className="day-markers">{mark.marks.map((kind) => <i className={`marker ${kind}`} key={kind} />)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <YearView year={year} selectedDate={selectedDate} todayDate={todayDate} marks={viewMarks} onSelect={(date) => { setSelectedDate(date); changeScale('month'); setAnchor(new Date(`${date}T00:00:00`)); }} />
              )}
            </section>

            <aside className={`upcoming-section ${upcomingOpen ? 'expanded' : ''}`}>
              <button
                className="upcoming-toggle"
                type="button"
                aria-expanded={upcomingOpen}
                aria-controls="upcoming-list"
                onClick={() => setUpcomingOpen((value) => !value)}
              >
                <span><strong>接下来</strong><small> · 最近的安排</small></span>
              </button>
              <p>你们已经确定的时间，会出现在这里。</p>
              <div className="schedule-list" id="upcoming-list">
                {[...(cloud.status === 'ready' ? liveUpcoming : upcoming.map((item) => ({ ...item, dateKey: item.key }))), ...localUpcoming].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).map((item) => (
                    <button className="schedule-item" type="button" key={item.key} onClick={() => { setUpcomingOpen(false); openDetail(item.dateKey); }}>
                    <strong>{item.date}</strong><span>{item.title}</span><small>{item.meta}</small>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </main>}
        {page === 'invite' && <InvitePage
          draft={inviteDraft}
          submitted={inviteSubmitted}
          feedback={inviteFeedback}
          onChange={setInviteDraft}
          onSubmit={submitInvite}
          onReset={() => { setInviteSubmitted(false); setInviteFeedback(''); setInviteDraft({ date: '', time: '', activities: [], otherActivity: '', location: '', note: '' }); }}
          onBack={() => goTo('calendar')}
        />}
        {page === 'plans' && <PlansPage onOpenDate={openDetail} onBack={() => goTo('calendar')} items={displayedPlanItems} live={cloud.status === 'ready'} />}
        {page === 'me' && <MePage records={viewRecords} noticePreferences={noticePreferences} onToggleNotice={(key) => setNoticePreferences((value) => ({ ...value, [key]: !value[key] }))} feedback={meFeedback} onFeedback={setMeFeedback} panel={mePanel} onPanel={setMePanel} onOpenRecordEditor={(type) => { openDetail('2026-09-09'); if (type === 'notes') setNoteEditorOpen(true); else setPhotoEditorOpen(true); }} />}
      </div>

      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        <NavItem icon="calendar" label="日历" active={page === 'calendar'} onClick={() => goTo('calendar')} />
        <NavItem icon="invite" label="邀请" active={page === 'invite'} onClick={() => goTo('invite')} />
        <NavItem icon="plans" label="安排" active={page === 'plans'} onClick={() => goTo('plans')} />
        <NavItem icon="me" label="我的" active={page === 'me'} onClick={() => goTo('me')} />
      </nav>

      {detailOpen && (
        <>
          <aside className="detail-panel open" role="dialog" aria-modal="true" aria-label="日期详情">
            <header className="detail-header">
              <div><h2>{selectedDateLabel}</h2><p>当天安排与共同回忆</p></div>
              <button className="detail-close" type="button" aria-label="关闭日期详情" onClick={closeDetail}>×</button>
            </header>
            <div className="detail-scroll">
              <div className="status-banner"><i />{responseFeedback || (selectedInvitation ? `${invitationStatusLabel(selectedInvitation.status)} · ${invitationTitle(selectedInvitation.activity)}` : selectedLocalInvitation ? `等待确认 · ${invitationTitle(selectedLocalInvitation.activities)}` : selectedDetail.status)}</div>
              {(selectedFallbackPending || selectedLocalInvitation || (selectedInvitation && (selectedInvitation.status === 'pending' || selectedInvitation.status === 'adjustment_pending'))) && !responseFeedback && (
                <section className="detail-block">
                  <h3>回应这份邀请</h3>
                  <div className="detail-response-actions">
                    <button type="button" onClick={() => void respondToSelectedInvitation({ type: selectedInvitation?.status === 'adjustment_pending' ? 'accept-adjustment' : 'confirm' })}>接受安排</button>
                    <button type="button" onClick={() => setResponseFeedback('已保留这份邀请，你可以稍后再决定。')}>暂不决定</button>
                  </div>
                </section>
              )}
              <section className="detail-block">
                <h3>当天安排</h3>
                <ul className="availability-list">
                  <li><span>我的时间</span><strong>{selectedAvailability}</strong></li>
                  <li><span>对方的时间</span><strong>{selectedPartnerAvailability ? formatPeriods(selectedPartnerAvailability.periods) : selectedDetail.partnerTime}</strong></li>
                  <li><span>活动</span><strong>{selectedArrangement.activity}</strong></li>
                  <li><span>地点</span><strong>{selectedArrangement.location}</strong></li>
                </ul>
                <button className="detail-action" type="button" aria-expanded={arrangementEditorOpen} onClick={() => {
                  setArrangementEditorOpen((value) => !value);
                  setArrangementFeedback('');
                  setArrangementDraft(selectedArrangement);
                }}><Icon name="edit" /><span>编辑当天安排</span></button>
                {arrangementEditorOpen && (
                  <div className="arrangement-editor">
                    <label htmlFor="arrangement-activity">活动</label>
                    <input id="arrangement-activity" value={arrangementDraft.activity === '尚未创建安排' ? '' : arrangementDraft.activity} maxLength={40} placeholder="例如：一起吃晚饭" onChange={(event) => setArrangementDraft((value) => ({ ...value, activity: event.target.value }))} />
                    <label htmlFor="arrangement-location">地点</label>
                    <input id="arrangement-location" value={arrangementDraft.location === '未填写' ? '' : arrangementDraft.location} maxLength={80} placeholder="例如：南山书店附近" onChange={(event) => setArrangementDraft((value) => ({ ...value, location: event.target.value }))} />
                    <button className="detail-action" type="button" onClick={() => {
                      setArrangements((value) => ({ ...value, [selectedDate]: {
                        activity: arrangementDraft.activity.trim() || '尚未创建安排',
                        location: arrangementDraft.location.trim() || '未填写',
                      } }));
                      setArrangementFeedback('当天安排已保存');
                      setArrangementEditorOpen(false);
                    }}><Icon name="check" /><span>保存安排</span></button>
                  </div>
                )}
                {arrangementFeedback && <p className="detail-action-feedback">{arrangementFeedback}</p>}
              </section>
              <section className="detail-block availability-block">
                <h3>我的可用时间</h3>
                <button
                  className="detail-action"
                  type="button"
                  aria-expanded={availabilityEditorOpen}
                  aria-controls="availability-editor"
                  onClick={() => {
                    setAvailabilityEditorOpen((value) => !value);
                    setAvailabilityFeedback('');
                    setAvailability(availabilityByDate[selectedDate]?.split('、') ?? []);
                  }}
                >
                  <Icon name="clock" />
                  <span>编辑我的可用时间</span>
                </button>
                {availabilityEditorOpen && (
                  <div className="availability-editor" id="availability-editor">
                    <div className="availability-options" role="group" aria-label="选择多个可用时间">
                      {['上午', '下午', '晚上'].map((time) => (
                        <button className={`availability-option ${availability.includes(time) ? 'active' : ''}`} type="button" aria-pressed={availability.includes(time)} key={time} onClick={() => setAvailability((items) => items.includes(time) ? items.filter((item) => item !== time) : [...items, time])}>{time}</button>
                      ))}
                    </div>
                    <button className="detail-action detail-save-action" type="button" onClick={async () => {
                      const value = availability.join('、');
                      setAvailabilityByDate((items) => {
                        const next = { ...items };
                        if (value) next[selectedDate] = value;
                        else delete next[selectedDate];
                        return next;
                      });
                      setAvailabilityEditorOpen(false);
                      setAvailabilityFeedback(value ? `已保存这一天的可用时间：${value}` : '已清除这一天的可用时间');
                      if (cloudRepository) {
                        const periods = availability
                          .map(periodFromLabel)
                          .filter((period): period is 'morning' | 'afternoon' | 'evening' => Boolean(period));
                        try {
                          await cloudRepository.saveAvailability({ date: selectedDate, periods, note: '' });
                          await refreshCloud();
                        } catch {
                          setAvailabilityFeedback('本地已保存，但云端同步失败，请稍后重试');
                        }
                      }
                    }}><Icon name="check" /><span>保存时间</span></button>
                  </div>
                )}
                {availabilityFeedback && <p className="detail-action-feedback">{availabilityFeedback}</p>}
              </section>
              <section className="detail-block">
                <div className="record-toolbar"><h3>文字记录</h3><div className="record-switcher" role="tablist" aria-label="切换记录查看对象">
                  <button className={`record-switch ${recordView === 'mine' ? 'active' : ''}`} type="button" onClick={() => setRecordView('mine')}>我</button>
                  <button className={`record-switch ${recordView === 'partner' ? 'active' : ''}`} type="button" onClick={() => setRecordView('partner')}>林林</button>
                </div></div>
                <p className="note-preview">{recordView === 'mine' ? (selectedNote ?? '还没有添加文字记录') : (selectedPartnerNote ?? '对方还没有添加文字记录')}</p>
                {recordView === 'mine' && (
                  <>
                    <button className="record-action" type="button" aria-expanded={noteEditorOpen} onClick={() => {
                      setNoteEditorOpen((value) => !value);
                      setNoteDraft(selectedNote ?? '');
                    }}><Icon name="edit" /><span>{noteEditorOpen ? '收起编辑' : '添加文字记录'}</span></button>
                    {noteEditorOpen && (
                      <form className="record-editor" onSubmit={async (event) => {
                        event.preventDefault();
                        const body = noteDraft.trim() || '还没有添加文字记录';
                        setNotes((value) => ({ ...value, [selectedDate]: body }));
                        setNoteEditorOpen(false);
                        if (cloudRepository) {
                          const operation = noteDraft.trim()
                            ? cloudRepository.saveDailyNote({ date: selectedDate, title: '文字记录', body })
                            : cloudRepository.deleteDailyNote(selectedDate);
                          try {
                            await operation;
                            await refreshCloud();
                          } catch {
                            setResponseFeedback('文字记录已保存在本地，但云端同步失败，请稍后重试');
                          }
                        }
                      }}>
                        <div className="record-editor-meta"><p className="record-editor-hint">写下今天想留下的话</p><span className="record-editor-count">{noteDraft.length}/500</span></div>
                        <textarea value={noteDraft} maxLength={500} placeholder="例如：今天见面很开心，想把这份心情留在这里" onChange={(event) => setNoteDraft(event.target.value)} />
                        <div className="record-editor-actions"><button type="button" onClick={() => setNoteEditorOpen(false)}>取消</button><button type="submit">保存记录</button></div>
                      </form>
                    )}
                  </>
                )}
              </section>
              <section className="detail-block">
                <h3>当天的照片</h3>
                {selectedPhotos.length > 0 ? <div className="detail-photo-list">{selectedPhotos.map((photo) => photo.startsWith('blob:') || photo.startsWith('http') ? <img src={photo} alt="当天照片预览" key={photo} /> : <span key={photo}>{photo}</span>)}</div> : <p className="plan-empty">还没有添加照片</p>}
                <button className="record-action" type="button" aria-expanded={photoEditorOpen} onClick={() => { setPhotoEditorOpen((value) => !value); setPhotoDraft([]); setPhotoFiles([]); setPhotoFeedback(''); }}><Icon name="photo" /><span>添加照片</span></button>
                {photoEditorOpen && (
                  <div className="record-editor">
                    <p className="record-editor-hint">一次可以选择多张，保存后会出现在当天照片里。</p>
                    <label className="photo-picker-label" htmlFor="detail-photo-input"><Icon name="photo" /><span>选择照片</span></label>
                    <input id="detail-photo-input" className="photo-input" type="file" accept="image/*" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); setPhotoFiles(files); setPhotoDraft(files.map((file) => URL.createObjectURL(file))); setPhotoFeedback(''); }} />
                    {photoDraft.length > 0 && <div className="photo-selection">{photoDraft.map((photo) => <img src={photo} alt="待保存照片预览" key={photo} />)}</div>}
                    {photoFeedback && <p className="detail-action-feedback">{photoFeedback}</p>}
                    <div className="record-editor-actions"><button type="button" onClick={() => { setPhotoEditorOpen(false); setPhotoDraft([]); setPhotoFiles([]); setPhotoFeedback(''); }}>取消</button><button type="button" onClick={() => void savePhotos()}>保存照片</button></div>
                  </div>
                )}
              </section>
            </div>
          </aside>
          <button className="detail-backdrop" type="button" aria-label="关闭日期详情" onClick={closeDetail} />
        </>
      )}
    </div>
  );
}

export function App() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [enteredWorkspace, setEnteredWorkspace] = useState(false);
  const enterWorkspace = () => {
    window.scrollTo(0, 0);
    setEnteredWorkspace(true);
  };
  if (enteredWorkspace) return <WorkspaceApp />;
  return <AuthScreen view={authView} onViewChange={setAuthView} onLoginSuccess={enterWorkspace} />;
}

function NavItem({ icon, label, active = false, onClick }: { icon: 'calendar' | 'invite' | 'plans' | 'me'; label: string; active?: boolean; onClick?: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} type="button" onClick={onClick}><Icon name={icon} /><span>{label}</span></button>;
}

type InviteDraft = { date: string; time: string; activities: string[]; otherActivity: string; location: string; note: string };

function InvitePage({ draft, submitted, feedback, onChange, onSubmit, onReset, onBack }: {
  draft: InviteDraft;
  submitted: boolean;
  feedback: string;
  onChange: (draft: InviteDraft) => void;
  onSubmit: () => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const activities = ['一起吃饭', '散步聊天', '看电影', '看展览', '喝咖啡', '其他'];
  const toggleActivity = (activity: string) => onChange({ ...draft, activities: draft.activities.includes(activity) ? draft.activities.filter((item) => item !== activity) : [...draft.activities, activity] });
  const activityText = draft.activities.map((activity) => activity === '其他' ? draft.otherActivity || '其他' : activity).join('、') || '暂时不确定';
  const dateText = draft.date ? formatInviteDateTime(draft.date, draft.time) : '还没有填写';
  return (
    <main className="workspace">
      <header className="workspace-heading">
        <div><p className="eyebrow">把下一次见面写下来</p><h1>发起邀请</h1><p className="workspace-copy">留下一段具体的时间，也给这次见面留一点期待。</p></div>
        <span className="connection-status"><i />共享空间已连接</span>
      </header>
      <div className={`invite-layout ${submitted ? 'submitted' : ''}`}>
        <section className="invite-card" aria-label="发起邀请表单">
          {!submitted ? <form className="invite-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            {feedback && <p className="invite-feedback" role="status">{feedback}</p>}
            <div className="invite-recipient-summary"><span className="contact-avatar">林</span><p><span>这份邀请会发给</span><strong>林林</strong></p></div>
            <InviteSection title="什么时候见面" copy="先约下一个舒服的时间，之后还可以再调整。">
              <div className="field-grid">
                <label className="field">日期<input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} /></label>
                <label className="field">时间<input type="time" value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })} /></label>
              </div>
            </InviteSection>
            <InviteSection title="去做什么" copy="可以多选、单选，也可以先不选。">
              <div className="activity-grid">{activities.map((activity) => <label className={`activity-option ${draft.activities.includes(activity) ? 'active' : ''}`} key={activity}><input type="checkbox" checked={draft.activities.includes(activity)} onChange={() => toggleActivity(activity)} /><span>{activity}</span></label>)}</div>
              {draft.activities.includes('其他') && <label className="field activity-other open">其他活动<input value={draft.otherActivity} maxLength={40} placeholder="例如：去逛花市" onChange={(event) => onChange({ ...draft, otherActivity: event.target.value })} /></label>}
            </InviteSection>
            <InviteSection title="在哪里见面" copy="写下一个你们都容易找到的地方。"><label className="field">地点<input value={draft.location} placeholder="例如：南山书店附近的咖啡店" onChange={(event) => onChange({ ...draft, location: event.target.value })} /></label></InviteSection>
            <InviteSection title="留言" copy="一句轻松的话就好，不填写也可以。"><label className="field">留言<textarea value={draft.note} maxLength={120} placeholder="例如：最近天气很好，想和你一起走走。" onChange={(event) => onChange({ ...draft, note: event.target.value })} /></label></InviteSection>
            <div className="invite-actions"><button className="secondary-button" type="button" onClick={onBack}>回到日历</button><button className="primary-button" type="submit">生成邀请</button></div>
          </form> : <div className="invite-result">{feedback && <p className="invite-feedback" role="status">{feedback}</p>}<div className="success-banner"><i aria-hidden="true">✓</i><div><strong>邀请已经写好了</strong><span>把这张卡片交给对方，等一个回复。</span></div></div><article className="result-card" aria-label="已生成的邀请卡片"><div className="result-card-header"><div><h2>一起见面吧</h2><p>写给林林的邀请</p></div><span className="result-status"><i />等待回应</span></div><dl className="preview-list"><PreviewRow label="时间" value={dateText} /><PreviewRow label="去做什么" value={activityText} /><PreviewRow label="地点" value={draft.location || '未填写'} /><PreviewRow label="留言" value={draft.note || '没有留言'} /></dl><div className="result-actions"><button className="secondary-button" type="button" onClick={onBack}>回到日历</button><button className="primary-button" type="button" onClick={onReset}>再发起一份</button></div></article></div>}
        </section>
        <aside className="invite-preview"><h2>邀请预览</h2><p>填写时，这里会帮你记住这份邀请的样子。</p><div className="preview-note">一份好的邀请，不需要太多话。把时间和心意说清楚，就已经足够。</div><dl className="preview-list"><PreviewRow label="对象" value="林林" /><PreviewRow label="时间" value={dateText} /><PreviewRow label="去做什么" value={activityText} /><PreviewRow label="地点" value={draft.location || '还没有填写'} /><PreviewRow label="留言" value={draft.note || '还没有填写'} /></dl></aside>
      </div>
    </main>
  );
}

function InviteSection({ title, copy, children }: { title: string; copy: string; children: ReactNode }) {
  return <section className="invite-form-section"><h2>{title}</h2><p>{copy}</p>{children}</section>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="preview-row"><dt>{label}</dt><dd>{value}</dd></div>;
}

type PlanViewItem = { date: string; title: string; meta: string; status: string; tone: 'pending' | 'confirmed' | 'memory' | 'expired' | 'cancelled'; key: string; dateKey: string };

function PlansPage({ onOpenDate, items, live }: { onOpenDate: (date: string) => void; onBack: () => void; items: PlanViewItem[]; live: boolean }) {
  const PlanSection = ({ title, copy, count, children }: { title: string; copy: string; count?: number; children: ReactNode }) => <section className="plans-section"><div className="plans-section-header"><div><h2>{title}</h2><p>{copy}</p></div>{count !== undefined && <span className="plans-count" aria-label={`${count} 项待处理`}>{count}</span>}</div>{children}</section>;
  const PlanItem = ({ item }: { item: PlanViewItem }) => <article className="plan-item"><div className="plan-main"><span className="plan-date">{item.date}</span><strong className="plan-title">{item.title}</strong><span className="plan-meta">{item.meta}</span><span className={`plan-status ${item.tone}`}><i />{item.status}</span></div><button className={`plan-action ${item.tone === 'pending' ? 'pending' : ''}`} type="button" aria-label={`查看${item.title}`} onClick={() => onOpenDate(item.dateKey)} /></article>;
  const pendingItems = items.filter((item) => item.tone === 'pending');
  const confirmedItems = items.filter((item) => item.tone === 'confirmed' || item.tone === 'memory');
  const endedItems = items.filter((item) => item.tone === 'expired' || item.tone === 'cancelled');
  return <main className="workspace"><header className="workspace-heading"><div><p className="eyebrow">把已经约好的时间收在这里</p><h1>我的安排</h1><p className="workspace-copy">先处理需要回应的邀请，再看看接下来已经确定的见面。</p></div><span className="connection-status"><i />共享空间已连接</span></header><div className="plans-layout">
    <PlanSection title="待我处理" copy="回应之后，这份安排才会真正确定下来。" count={pendingItems.length}>{pendingItems.length > 0 ? pendingItems.map((item) => <PlanItem item={item} key={item.key} />) : <p className="plan-empty">暂时没有需要回应的邀请。</p>}</PlanSection>
    <PlanSection title="已确认" copy="你们已经约好的下一次见面。">{confirmedItems.length > 0 ? confirmedItems.map((item) => <PlanItem item={item} key={item.key} />) : <p className="plan-empty">还没有已经确定的安排。</p>}</PlanSection>
        <PlanSection title="还没有安排的日子" copy="可以从日历里挑一天，或者发起一份新的邀请。"><p className="plan-empty">当你们留下新的时间，这里会继续整理好。</p></PlanSection>
    <PlanSection title="已结束或取消" copy="过去的安排会留在这里，方便你们回看。">{endedItems.length > 0 ? endedItems.map((item) => <PlanItem item={item} key={item.key} />) : <p className="plan-empty">还没有结束或取消的安排。</p>}</PlanSection>
  </div></main>;
}

function MePage({ records, noticePreferences, onToggleNotice, feedback, onFeedback, panel, onPanel, onOpenRecordEditor }: {
  records: RecordsViewModel;
  noticePreferences: { invite: boolean; changes: boolean };
  onToggleNotice: (key: 'invite' | 'changes') => void;
  feedback: string;
  onFeedback: (value: string) => void;
  panel: 'profile' | 'space' | null;
  onPanel: (value: 'profile' | 'space' | null) => void;
  onOpenRecordEditor: (type: 'notes' | 'photos') => void;
}) {
  const [email, setEmail] = useState('当前登录邮箱');
  const [editor, setEditor] = useState<'email' | 'password' | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState({ current: '', next: '' });
  const [accountFeedback, setAccountFeedback] = useState('');
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsType, setRecordsType] = useState<RecordType>('notes');
  const [recordsPerson, setRecordsPerson] = useState<RecordPerson>('mine');
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsVisibleLimit, setRecordsVisibleLimit] = useState(6);
  const [photoPreview, setPhotoPreview] = useState<RecordItem | null>(null);
  const closeEditor = () => {
    setEditor(null);
    setEmailDraft('');
    setPasswordDraft({ current: '', next: '' });
  };

  useEffect(() => {
    document.body.style.overflow = recordsOpen ? 'hidden' : '';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (photoPreview) setPhotoPreview(null);
      else if (recordsOpen) setRecordsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [photoPreview, recordsOpen]);

  const openRecords = (type: RecordType) => {
    setRecordsType(type);
    setRecordsPerson('mine');
    setRecordsSearch('');
    setRecordsVisibleLimit(6);
    setPhotoPreview(null);
    setRecordsOpen(true);
  };

  return (
    <>
      <main className="workspace">
      <header className="workspace-heading">
        <div><p className="eyebrow">只属于你们的这一页</p><h1>我的</h1><p className="workspace-copy">看看你们一起留下了什么，也调整这里的提醒方式。</p></div>
        <span className="connection-status"><i />共享空间已连接</span>
      </header>
      <div className="me-layout">
        <section className="me-card" aria-labelledby="me-profile-title">
          <div className="me-profile"><span className="me-avatar" aria-hidden="true">你</span><div><h2 id="me-profile-title">uka</h2><p>和林林一起使用这个共享空间</p></div></div>
          <div className="me-stats" aria-label="共同记录统计">
            <button className="me-stat" type="button" onClick={() => openRecords('plans')}><strong>{records.plans.length}</strong><span>共同安排</span><i /></button>
            <button className="me-stat" type="button" onClick={() => openRecords('notes')}><strong>{records.notes.mine.length}</strong><span>文字记录</span><i /></button>
            <button className="me-stat" type="button" onClick={() => openRecords('photos')}><strong>{records.photos.mine.length}</strong><span>照片回忆</span><i /></button>
          </div>
          {feedback && <p className="me-feedback" aria-live="polite">{feedback}</p>}
        </section>

        <section className="me-card" aria-labelledby="me-space-title">
          <h2 id="me-space-title">共享空间</h2>
          <p className="me-card-copy">你们的连接保持正常，新的安排会同步出现在日历里。</p>
          <div className="me-list">
            <div className="me-row"><div><strong>共享对象</strong><span>林林</span></div><span className="plan-status confirmed"><i />已连接</span></div>
            <div className="me-row"><div><strong>最近一次同步</strong><span>刚刚</span></div><span className="plan-status confirmed"><i />正常</span></div>
          </div>
        </section>

        <section className="me-card" aria-labelledby="me-preference-title">
          <h2 id="me-preference-title">提醒偏好</h2>
          <p className="me-card-copy">只在有新的安排或需要你回应时提醒。</p>
          <div className="me-list">
            <div className="me-row"><div><strong>新邀请提醒</strong><span>有人发来新的见面邀请时</span></div><button className={`me-switch ${noticePreferences.invite ? 'active' : ''}`} type="button" aria-label={`新邀请提醒 ${noticePreferences.invite ? '已开启' : '已关闭'}`} aria-pressed={noticePreferences.invite} onClick={() => onToggleNotice('invite')} /></div>
            <div className="me-row"><div><strong>安排变更提醒</strong><span>时间、地点或状态发生变化时</span></div><button className={`me-switch ${noticePreferences.changes ? 'active' : ''}`} type="button" aria-label={`安排变更提醒 ${noticePreferences.changes ? '已开启' : '已关闭'}`} aria-pressed={noticePreferences.changes} onClick={() => onToggleNotice('changes')} /></div>
          </div>
        </section>

        <aside className="me-card" aria-labelledby="me-actions-title">
          <h2 id="me-actions-title">账号与空间</h2>
          <p className="me-card-copy">这里的操作暂时只展示交互，不会修改真实账号。</p>
          <button className="me-action" type="button" aria-expanded={panel === 'profile'} onClick={() => onPanel(panel === 'profile' ? null : 'profile')}>个人资料</button>
          {panel === 'profile' && <div className="me-detail-panel me-profile-detail">
            <div className="me-detail-line"><span>昵称</span><strong>uka</strong></div>
            <div className="me-detail-line"><span>登录邮箱</span><strong>{email}</strong></div>
            <div className="me-detail-line"><span>共享对象</span><strong>林林</strong></div>
            <div className="me-detail-line"><span>加入时间</span><strong>2026年9月</strong></div>
            <div className="me-subactions" aria-label="账号修改">
              <button className="me-subaction" type="button" aria-expanded={editor === 'email'} onClick={() => { setAccountFeedback(''); setEditor(editor === 'email' ? null : 'email'); }}>修改邮箱</button>
              {editor === 'email' && <form className="me-password-form" onSubmit={(event) => { event.preventDefault(); if (!emailDraft.trim() || !emailDraft.includes('@')) { setAccountFeedback('请输入有效的邮箱地址。'); return; } setEmail(emailDraft.trim()); setAccountFeedback('邮箱已更新，当前页面仅展示交互效果。'); closeEditor(); }}><label htmlFor="me-email-draft">新邮箱</label><input id="me-email-draft" type="email" value={emailDraft} placeholder="输入新的登录邮箱" onChange={(event) => setEmailDraft(event.target.value)} /><button className="me-password-submit" type="submit">保存新邮箱</button></form>}
              <button className="me-subaction" type="button" aria-expanded={editor === 'password'} onClick={() => { setAccountFeedback(''); setEditor(editor === 'password' ? null : 'password'); }}>修改密码</button>
              {editor === 'password' && <form className="me-password-form" onSubmit={(event) => { event.preventDefault(); if (!passwordDraft.current || passwordDraft.next.length < 8) { setAccountFeedback('请输入当前密码，并设置至少 8 位的新密码。'); return; } setAccountFeedback('密码已更新，当前页面仅展示交互效果。'); closeEditor(); }}><label htmlFor="me-current-password">当前密码</label><input id="me-current-password" type="password" value={passwordDraft.current} placeholder="输入当前密码" onChange={(event) => setPasswordDraft((value) => ({ ...value, current: event.target.value }))} /><label htmlFor="me-new-password">新密码</label><input id="me-new-password" type="password" value={passwordDraft.next} placeholder="至少 8 位字符" onChange={(event) => setPasswordDraft((value) => ({ ...value, next: event.target.value }))} /><button className="me-password-submit" type="submit">保存新密码</button></form>}
            </div>
            {accountFeedback && <p className="me-feedback" aria-live="polite">{accountFeedback}</p>}
          </div>}
          <button className="me-action" type="button" aria-expanded={panel === 'space'} onClick={() => onPanel(panel === 'space' ? null : 'space')}>共享空间设置</button>
          {panel === 'space' && <div className="me-detail-panel me-space-detail">
            <div className="me-detail-line"><span>空间名称</span><strong>留一页给我们</strong></div>
            <div className="me-detail-line"><span>同步状态</span><strong>正常</strong></div>
            <div className="me-detail-line"><span>共享对象</span><strong>林林</strong></div>
          </div>}
          <button className="me-action" type="button" onClick={() => onFeedback('退出登录入口已打开。')}>退出登录</button>
          {feedback && <p className="me-feedback" aria-live="polite">{feedback}</p>}
        </aside>
      </div>
      </main>
      <RecordsBrowser
        records={records}
        open={recordsOpen}
        type={recordsType}
        person={recordsPerson}
        search={recordsSearch}
        visibleLimit={recordsVisibleLimit}
        photoPreview={photoPreview}
        onClose={() => setRecordsOpen(false)}
        onTypeChange={(value) => { setRecordsType(value); setRecordsPerson('mine'); setRecordsVisibleLimit(6); setRecordsSearch(''); setPhotoPreview(null); }}
        onPersonChange={(value) => { setRecordsPerson(value); setRecordsVisibleLimit(6); setPhotoPreview(null); }}
        onSearchChange={(value) => { setRecordsSearch(value); setRecordsVisibleLimit(6); }}
        onLoadMore={() => setRecordsVisibleLimit((value) => value + 6)}
        onPhotoOpen={setPhotoPreview}
        onPhotoClose={() => setPhotoPreview(null)}
        onAdd={(value) => { setRecordsOpen(false); onOpenRecordEditor(value); }}
      />
    </>
  );
}

function RecordsBrowser({
  records,
  open,
  type,
  person,
  search,
  visibleLimit,
  photoPreview,
  onClose,
  onTypeChange,
  onPersonChange,
  onSearchChange,
  onLoadMore,
  onPhotoOpen,
  onPhotoClose,
  onAdd,
}: {
  records: RecordsViewModel;
  open: boolean;
  type: RecordType;
  person: RecordPerson;
  search: string;
  visibleLimit: number;
  photoPreview: RecordItem | null;
  onClose: () => void;
  onTypeChange: (value: RecordType) => void;
  onPersonChange: (value: RecordPerson) => void;
  onSearchChange: (value: string) => void;
  onLoadMore: () => void;
  onPhotoOpen: (value: RecordItem) => void;
  onPhotoClose: () => void;
  onAdd: (value: 'notes' | 'photos') => void;
}) {
  const source = type === 'plans' ? records.plans : records[type][person];
  const filtered = useMemo(() => source
    .filter((record) => `${record.date} ${record.title} ${record.detail ?? ''} ${record.status ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [source, search]);
  const visible = filtered.slice(0, visibleLimit);
  const groups = visible.reduce<Record<string, RecordItem[]>>((result, record) => {
    const month = record.date.slice(0, 7);
    (result[month] ??= []).push(record);
    return result;
  }, {});
  const typeNames: Record<RecordType, string> = { plans: '共同安排', notes: '文字记录', photos: '照片回忆' };
  const recordName = type === 'plans' ? '共同安排' : type === 'notes' ? '文字记录' : '照片回忆';
  const formatDateLabel = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  const statusTone = (status?: string) => status === '已确定' ? ' confirmed' : status === '等待确认' ? ' pending' : '';

  return (
    <section className={`records-browser ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="记录浏览器">
      <div className="records-browser-inner" role="dialog" aria-modal="true" aria-labelledby="records-title">
        <header className="records-browser-header">
          <button className="records-back" type="button" aria-label="返回我的页面" onClick={onClose}>‹</button>
          <div className="records-browser-heading"><p>留在一起的日子</p><h2 id="records-title">{typeNames[type]}</h2></div>
          {type !== 'plans' && person === 'mine' && <button className="records-add" type="button" aria-label={`添加${type === 'notes' ? '文字记录' : '照片'}`} title="添加记录" onClick={() => onAdd(type)}>+</button>}
          <span className="records-browser-count">{filtered.length} 条</span>
        </header>
        <div className="records-controls">
          <div className="records-tabs" role="group" aria-label="记录类型">
            {(['plans', 'notes', 'photos'] as RecordType[]).map((item) => <button key={item} type="button" aria-pressed={type === item} onClick={() => onTypeChange(item)}>{item === 'plans' ? '安排' : item === 'notes' ? '文字' : '照片'}</button>)}
          </div>
          <label className="records-search"><span className="visually-hidden">搜索记录</span><input type="search" value={search} placeholder="搜索日期、内容或地点" onChange={(event) => onSearchChange(event.target.value)} /></label>
        </div>
        {type !== 'plans' && <div className="records-person-row">
          <span>正在查看{person === 'mine' ? '自己的' : '林林的'}{type === 'notes' ? '文字记录' : '照片回忆'}</span>
          <div className="records-people" role="group" aria-label="查看谁的记录">
            <button type="button" aria-pressed={person === 'mine'} onClick={() => onPersonChange('mine')}>我</button>
            <button type="button" aria-pressed={person === 'partner'} onClick={() => onPersonChange('partner')}>林林</button>
          </div>
        </div>}
        <div className="records-months" aria-live="polite">
          {Object.entries(groups).map(([month, items], groupIndex) => (
            <details className="records-month" key={month} open={groupIndex === 0}>
              <summary><span>{month.slice(0, 4)}年{Number(month.slice(5))}月</span><span className="records-month-count">{items.length} 条</span></summary>
              <div className="records-month-content">
                {type === 'notes' && items.map((record) => <article className="records-note" key={`${record.date}-${record.title}`}><time dateTime={record.date}>{formatDateLabel(record.date)}</time><p>{record.title}</p></article>)}
                {type === 'plans' && items.map((record) => <article className="records-plan" key={`${record.date}-${record.title}`}><div className="records-plan-main"><time dateTime={record.date}>{formatDateLabel(record.date)}</time><strong>{record.title}</strong><small>{record.detail}</small></div><span className={`plan-status${statusTone(record.status)}`}><i />{record.status}</span></article>)}
                {type === 'photos' && <div className="records-photo-grid">{items.map((record, photoIndex) => <button className="records-photo" type="button" key={`${record.date}-${record.title}`} onClick={() => onPhotoOpen(record)} aria-label={`${record.title}，打开照片预览`}><span className="records-photo-thumb" data-tone={photoIndex % 4}><span>{record.date.slice(5).replace('-', '.')}</span></span><time dateTime={record.date}>{formatDateLabel(record.date)}</time><strong>{record.title}</strong></button>)}</div>}
              </div>
            </details>
          ))}
        </div>
        {filtered.length === 0 && <div className="records-empty">{source.length ? '没有找到符合条件的记录' : `还没有${recordName}`}</div>}
        <div className="records-load-row"><button className="records-load" type="button" hidden={filtered.length <= visibleLimit} onClick={onLoadMore}>加载更早记录</button></div>
      </div>
      {photoPreview && <div className="records-photo-viewer" role="dialog" aria-modal="true" aria-label="照片预览" onClick={onPhotoClose}>
        <div className="records-photo-viewer-content" onClick={(event) => event.stopPropagation()}>
          <button className="records-photo-viewer-close" type="button" aria-label="关闭照片" onClick={onPhotoClose}>×</button>
          <div className="records-photo-viewer-image" data-tone={photoPreview.date.slice(-1)}><span>{formatDateLabel(photoPreview.date)}</span></div>
          <p>{photoPreview.title}</p>
        </div>
      </div>}
    </section>
  );
}

function LegendMark({ kind, label }: { kind: DateMark; label: string }) {
  return <span className="legend-item"><i className={`legend-mark ${kind}`} />{label}</span>;
}

function YearView({ year, selectedDate, todayDate, marks: viewMarks, onSelect }: { year: number; selectedDate: string; todayDate: string; marks: Record<string, ViewCalendarMark>; onSelect: (date: string) => void }) {
  return (
    <div className="year-view">
      {monthNames.map((name, month) => (
        <section className="year-month" key={name}>
          <button type="button" className="year-month-title" onClick={() => onSelect(formatDate(year, month, 1))}><strong>{name}</strong><span>›</span></button>
          <div className="year-grid">
            {weekdays.map((weekday) => <span className="year-weekday" key={weekday}>{weekday}</span>)}
            {getMonthDays(year, month).map((item) => {
              const mark = viewMarks[item.date];
              return <button type="button" key={item.date} disabled={item.muted} className={`${item.muted ? 'muted' : ''} ${selectedDate === item.date ? 'selected' : ''} ${todayDate === item.date ? 'today' : ''} ${mark?.primary ?? ''}`} onClick={() => onSelect(item.date)}>{item.day}{mark && <i className="year-dot" />}</button>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
