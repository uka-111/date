import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import { useBookingData } from '../../app/useBookingData';
import type { PartnerId } from '../../domain/models';
import { DayPanel } from './DayPanel';

interface MonthCalendarProps {
  initialMonth?: string;
  repository: DateBookingRepository;
  partnerId: PartnerId;
}

export function MonthCalendar({
  initialMonth = format(new Date(), 'yyyy-MM'),
  repository,
  partnerId,
}: MonthCalendarProps) {
  const [month, setMonth] = useState(() => parseISO(`${initialMonth}-01`));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { database, refresh } = useBookingData(repository);
  const calendarStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <section aria-labelledby="calendar-heading">
      <header>
        <button
          type="button"
          aria-label="上个月"
          onClick={() => setMonth((current) => subMonths(current, 1))}
        >
          ‹
        </button>
        <h2 id="calendar-heading">{format(month, 'yyyy年M月')}</h2>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => setMonth((current) => addMonths(current, 1))}
        >
          ›
        </button>
      </header>

      <div role="grid" aria-label="共享月历">
        {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
        {days.map((day) => {
          const date = format(day, 'yyyy-MM-dd');
          const hasAvailability = database.availability.some(
            (value) => value.date === date,
          );
          return (
            <button
              type="button"
              key={date}
              aria-label={format(day, 'M月d日')}
              aria-selected={selectedDate === date}
              disabled={!isSameMonth(day, month)}
              data-has-availability={hasAvailability || undefined}
              onClick={() => setSelectedDate(date)}
            >
              {format(day, 'd')}
              {hasAvailability && <span aria-hidden="true">•</span>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          partnerId={partnerId}
          availability={database.availability}
          repository={repository}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
