import { useState, type FormEvent } from 'react';
import type { Invitation, Period } from '../../domain/models';

interface AdjustmentValue {
  date: string;
  period: Period;
  activity: string;
  note: string;
}

interface AdjustmentFormProps {
  invitation: Invitation;
  onSubmit: (value: AdjustmentValue) => void;
  onCancel: () => void;
}

const periodOptions: Array<{ value: Period; label: string }> = [
  { value: 'all_day', label: '全天' },
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

export function AdjustmentForm({
  invitation,
  onSubmit,
  onCancel,
}: AdjustmentFormProps) {
  const [date, setDate] = useState(invitation.date);
  const [period, setPeriod] = useState<Period>(invitation.period);
  const [activity, setActivity] = useState(invitation.activity);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || !activity.trim()) {
      setError('请填写调整后的日期和活动');
      return;
    }
    onSubmit({ date, period, activity: activity.trim(), note: note.trim() });
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <label htmlFor="adjustment-date">调整后的日期</label>
      <input
        id="adjustment-date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />

      <fieldset>
        <legend>调整后的时段</legend>
        {periodOptions.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="adjustment-period"
              aria-label={`调整为${option.label}`}
              checked={period === option.value}
              onChange={() => setPeriod(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <label htmlFor="adjustment-activity">调整后的活动</label>
      <input
        id="adjustment-activity"
        value={activity}
        onChange={(event) => setActivity(event.target.value)}
      />

      <label htmlFor="adjustment-note">调整原因或想说的话</label>
      <textarea
        id="adjustment-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && <p role="alert">{error}</p>}
      <button type="submit">发送调整建议</button>
      <button type="button" onClick={onCancel}>
        返回
      </button>
    </form>
  );
}
