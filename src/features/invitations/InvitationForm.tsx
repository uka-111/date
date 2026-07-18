import { useState, type FormEvent } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import { createInvitation } from '../../domain/createInvitation';
import type { PartnerId, Period } from '../../domain/models';
import { activityOptions } from './activityOptions';

const periods: Array<{ value: Period; label: string }> = [
  { value: 'all_day', label: '全天' },
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

interface InvitationFormProps {
  partnerId: PartnerId;
  repository: DateBookingRepository;
  onSaved: () => void;
  initialDate?: string;
}

interface FormErrors {
  date?: string;
  period?: string;
  activity?: string;
  customActivity?: string;
  general?: string;
}

export function InvitationForm({
  partnerId,
  repository,
  onSaved,
  initialDate = '',
}: InvitationFormProps) {
  const [date, setDate] = useState(initialDate);
  const [period, setPeriod] = useState<Period | null>(null);
  const [activity, setActivity] = useState('');
  const [customActivity, setCustomActivity] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState('');

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!date) nextErrors.date = '日期不能为空';
    if (!period) nextErrors.period = '时段不能为空';
    if (!activity) nextErrors.activity = '活动不能为空';
    if (activity === 'custom' && !customActivity.trim()) {
      nextErrors.customActivity = '请填写自定义活动';
    }
    return nextErrors;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSuccess('');
      return;
    }

    try {
      const invitation = createInvitation({
        senderId: partnerId,
        date,
        period,
        activity: activity === 'custom' ? customActivity : activity,
        note,
      });
      repository.saveInvitationWithNotification(invitation, {
        id: crypto.randomUUID(),
        recipientId: invitation.recipientId,
        invitationId: invitation.id,
        kind: 'created',
        createdAt: invitation.createdAt,
        readAt: null,
      });
      setErrors({});
      setDate('');
      setPeriod(null);
      setActivity('');
      setCustomActivity('');
      setNote('');
      setSuccess(`邀请已经发给${invitation.recipientId === 'her' ? '她' : '他'}啦`);
      onSaved();
    } catch {
      setErrors({ general: '保存失败，请重试' });
      setSuccess('');
    }
  }

  return (
    <form className="form-card card" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="invitation-date">日期</label>
        <input
          id="invitation-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {errors.date && <p role="alert">{errors.date}</p>}
      </div>

      <fieldset>
        <legend>时段</legend>
        {periods.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="invitation-period"
              checked={period === option.value}
              onChange={() => setPeriod(option.value)}
            />
            {option.label}
          </label>
        ))}
        {errors.period && <p role="alert">{errors.period}</p>}
      </fieldset>

      <fieldset>
        <legend>想一起做什么？</legend>
        <div className="activity-grid">
          {activityOptions.map((option) => (
            <button
              className="activity-option"
              type="button"
              key={option.value}
              aria-pressed={activity === option.value}
              onClick={() => setActivity(option.value)}
            >
              <span aria-hidden="true">{option.icon}</span> {option.label}
            </button>
          ))}
          <button
            className="activity-option"
            type="button"
            aria-label="自定义"
            aria-pressed={activity === 'custom'}
            onClick={() => setActivity('custom')}
          >
            ✨ 自定义
          </button>
        </div>
        {errors.activity && <p role="alert">{errors.activity}</p>}
      </fieldset>

      {activity === 'custom' && (
        <div>
          <label htmlFor="custom-activity">自定义活动</label>
          <input
            id="custom-activity"
            value={customActivity}
            onChange={(event) => setCustomActivity(event.target.value)}
          />
          {errors.customActivity && (
            <p role="alert">{errors.customActivity}</p>
          )}
        </div>
      )}

      <label htmlFor="invitation-note">想说的话</label>
      <textarea
        id="invitation-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="例如：好久没一起看电影啦"
      />

      {errors.general && <p role="alert">{errors.general}</p>}
      {success && <p role="status">{success}</p>}
      <button type="submit">发送约会邀请</button>
    </form>
  );
}
