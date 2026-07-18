import type { DateBookingRepository } from '../../app/repository';
import type { Availability, PartnerId, Period } from '../../domain/models';
import { AvailabilityEditor } from './AvailabilityEditor';

const periodLabels: Record<Period, string> = {
  all_day: '全天',
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

function availabilityText(value: Availability) {
  const partner = value.ownerId === 'him' ? '他' : '她';
  return `${partner}：${value.periods.map((period) => periodLabels[period]).join('、')}`;
}

interface DayPanelProps {
  date: string;
  partnerId: PartnerId;
  availability: Availability[];
  repository: DateBookingRepository;
  onSaved: () => void;
}

export function DayPanel({
  date,
  partnerId,
  availability,
  repository,
  onSaved,
}: DayPanelProps) {
  const dayAvailability = availability.filter((value) => value.date === date);
  const ownAvailability = dayAvailability.find(
    (value) => value.ownerId === partnerId,
  );

  return (
    <section className="day-panel" aria-labelledby="selected-day-heading">
      <h3 id="selected-day-heading">{date} 的安排</h3>
      {dayAvailability.length > 0 ? (
        <ul>
          {dayAvailability.map((value) => (
            <li key={value.id}>{availabilityText(value)}</li>
          ))}
        </ul>
      ) : (
        <p>这一天还没有人标记空闲时间。</p>
      )}
      <AvailabilityEditor
        date={date}
        partnerId={partnerId}
        existing={ownAvailability}
        repository={repository}
        onSaved={onSaved}
      />
    </section>
  );
}
