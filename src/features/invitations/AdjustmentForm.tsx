import { useState, type FormEvent } from 'react';
import type { Invitation, Period } from '../../domain/models';
import { activityOptions } from './activityOptions';

interface AdjustmentValue {
  date: string;
  periods: Period[];
  activity: string[];
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

const presetActivities = new Set<string>(
  activityOptions.map((option) => option.value),
);

export function AdjustmentForm({
  invitation,
  onSubmit,
  onCancel,
}: AdjustmentFormProps) {
  const initialUnknownActivities = invitation.activity.filter(
    (activity) => !presetActivities.has(activity),
  );
  const initialCustomActivity =
    initialUnknownActivities.length === 1
      ? initialUnknownActivities[0]
      : undefined;
  const [date, setDate] = useState(invitation.date);
  const [selectedPeriods, setSelectedPeriods] = useState<Period[]>(
    invitation.periods,
  );
  const [selectedActivities, setSelectedActivities] = useState<string[]>(
    invitation.activity,
  );
  const [customSelected, setCustomSelected] = useState(
    initialCustomActivity !== undefined,
  );
  const [customActivity, setCustomActivity] = useState(
    initialCustomActivity ?? '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || selectedPeriods.length === 0) {
      setError('请填写调整后的日期、时段和活动');
      return;
    }
    const selectedWithoutInitialCustom = initialCustomActivity !== undefined
      ? selectedActivities.filter(
          (activity) => activity !== initialCustomActivity,
        )
      : selectedActivities;
    if (selectedWithoutInitialCustom.length === 0 && !customSelected) {
      setError('活动不能为空');
      return;
    }
    if (customSelected && !customActivity.trim()) {
      setError('请填写自定义活动');
      return;
    }
    const activities = initialCustomActivity !== undefined
      ? selectedActivities
          .filter((activity) => customSelected || activity !== initialCustomActivity)
          .map((activity) =>
            activity === initialCustomActivity ? customActivity.trim() : activity,
          )
      : [
          ...selectedActivities,
          ...(customSelected ? [customActivity.trim()] : []),
        ];
    onSubmit({
      date,
      periods: selectedPeriods,
      activity: activities,
      note: note.trim(),
    });
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
              type="checkbox"
              name="adjustment-period"
              aria-label={`调整为${option.label}`}
              checked={selectedPeriods.includes(option.value)}
              onChange={(event) => setSelectedPeriods((current) =>
                event.target.checked
                  ? [...current, option.value]
                  : current.filter((period) => period !== option.value),
              )}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>调整后的活动</legend>
        <div className="activity-grid">
          {activityOptions.map((option) => (
            <button
              className="activity-option"
              type="button"
              key={option.value}
              aria-pressed={selectedActivities.includes(option.value)}
              onClick={() =>
                setSelectedActivities((current) =>
                  current.includes(option.value)
                    ? current.filter((activity) => activity !== option.value)
                    : [...current, option.value],
                )
              }
            >
              <span aria-hidden="true">{option.icon}</span> {option.label}
            </button>
          ))}
          {initialUnknownActivities.length > 1 &&
            initialUnknownActivities.map((activity, index) => (
              <button
                className="activity-option"
                type="button"
                key={`${activity}-${index}`}
                aria-label={activity}
                aria-pressed={selectedActivities.includes(activity)}
                onClick={() =>
                  setSelectedActivities((current) =>
                    current.includes(activity)
                      ? current.filter((selected) => selected !== activity)
                      : [...current, activity],
                  )
                }
              >
                <span aria-hidden="true">✨</span> {activity}
              </button>
            ))}
          <button
            className="activity-option"
            type="button"
            aria-label="自定义"
            aria-pressed={customSelected}
            onClick={() => setCustomSelected((current) => !current)}
          >
            ✨ 自定义
          </button>
        </div>
      </fieldset>

      {customSelected && (
        <div>
          <label htmlFor="adjustment-custom-activity">自定义活动</label>
          <input
            id="adjustment-custom-activity"
            value={customActivity}
            onChange={(event) => setCustomActivity(event.target.value)}
          />
        </div>
      )}

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
