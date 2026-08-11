import { useEffect, useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';

export function DailyNoteEditor({ date, repository, onSaved }: { date: string; repository: DateBookingRepository; onSaved?: () => void }) {
  const saved = repository.getDailyNote(date);
  const [title, setTitle] = useState(saved?.title ?? '');
  const [body, setBody] = useState(saved?.body ?? '');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const note = repository.getDailyNote(date);
    setTitle(note?.title ?? ''); setBody(note?.body ?? ''); setDirty(false); setStatus('');
  }, [date, repository]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function save() {
    const cleanBody = body.trim();
    if (!cleanBody) { setStatus('正文不能为空'); return; }
    const now = new Date().toISOString();
    repository.saveDailyNote({ date, title: title.trim(), body: cleanBody, createdAt: saved?.createdAt ?? now, updatedAt: now });
    setDirty(false); setStatus('记录已保存'); onSaved?.();
  }
  function remove() {
    if (!window.confirm('确定删除这篇记录吗？')) return;
    repository.deleteDailyNote(date); setTitle(''); setBody(''); setDirty(false); setStatus('记录已删除'); onSaved?.();
  }
  return <section className="daily-note daily-note-editor" aria-label="每日文字回忆">
    <h4>当天记录</h4>
    <label htmlFor={`note-title-${date}`}>记录标题</label>
    <input id={`note-title-${date}`} value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
    <label htmlFor={`note-body-${date}`}>当天记录</label>
    <textarea id={`note-body-${date}`} value={body} onChange={(event) => { setBody(event.target.value); setDirty(true); }} />
    {dirty && <p role="status">有未保存的修改</p>}
    {status && <p role="status">{status}</p>}
    <div className="daily-note-actions">
      <button className="daily-note-save" type="button" onClick={save}>保存记录</button>
      {repository.getDailyNote(date) && <button className="daily-note-delete" type="button" onClick={remove}>删除记录</button>}
    </div>
  </section>;
}
