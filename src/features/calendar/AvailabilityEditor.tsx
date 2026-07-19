import { useEffect, useState, type FormEvent } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import { createAvailability } from '../../domain/availability';
import type { Availability, PartnerId, Period } from '../../domain/models';

const periodOptions: Array<{ value: Period; label: string }> = [
  { value: 'all_day', label: '全天' },
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

interface AvailabilityEditorProps {
  date: string;
  partnerId: PartnerId;
  existing?: Availability;
  repository: DateBookingRepository;
  onSaved: () => void;
}

export function AvailabilityEditor({
  date,
  partnerId,
  existing,
  repository,
  onSaved,
}: AvailabilityEditorProps) {
  const [periods, setPeriods] = useState<Period[]>(existing?.periods ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setPeriods(existing?.periods ?? []);
    setNote(existing?.note ?? '');
    setError('');
  }, [date, existing]);

  function togglePeriod(period: Period) {
    setPeriods((current) =>
      current.includes(period)
        ? current.filter((value) => value !== period)
        : [...current, period],
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      repository.saveAvailability(
        createAvailability({ ownerId: partnerId, date, periods, note }),
      );
      setError('');
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试');
    }
  }

  return (
    <form className="inline-form" onSubmit={save}>
      <fieldset>
        <legend>我的空闲时段</legend>
        {periodOptions.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={periods.includes(option.value)}
              onChange={() => togglePeriod(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`availability-note-${date}`}>补充说明</label>
      <input
        id={`availability-note-${date}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="例如：下班后可以"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">保存我的空闲时间</button>
    </form>
  );
}
