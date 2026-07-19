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
import { useEffect, useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import { useBookingData } from '../../app/useBookingData';
import type { PartnerId } from '../../domain/models';
import { summarizeDateState } from '../../domain/dateState';
import { DayPanel } from './DayPanel';
import { StatusLegend } from './StatusLegend';
import type { PhotoRepository } from '../../storage/photoRepository';

interface MonthCalendarProps {
  initialMonth?: string;
  repository: DateBookingRepository;
  partnerId: PartnerId;
  initialSelectedDate?: string;
  photoRepository?: PhotoRepository;
}

export function MonthCalendar({
  initialMonth = format(new Date(), 'yyyy-MM'),
  repository,
  partnerId,
  initialSelectedDate,
  photoRepository,
}: MonthCalendarProps) {
  const [month, setMonth] = useState(() => parseISO(`${initialMonth}-01`));
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelectedDate ?? null);
  const { database, refresh } = useBookingData(repository);
  const calendarStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const [photoDates, setPhotoDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!photoRepository) return;
    let active = true;
    Promise.all(days.map(async (day) => {
      const date = format(day, 'yyyy-MM-dd');
      return await photoRepository.count(date) > 0 ? date : null;
    })).then((values) => {
      if (active) setPhotoDates(new Set(values.filter((value): value is string => Boolean(value))));
    });
    return () => { active = false; };
  }, [photoRepository, month, database]);

  return (
    <section className="calendar-card card" aria-labelledby="calendar-heading">
      <header className="calendar-header">
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
      <StatusLegend />

      <div className="calendar-grid" role="grid" aria-label="共享月历">
        {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
          <span className="weekday" key={weekday}>{weekday}</span>
        ))}
        {days.map((day) => {
          const date = format(day, 'yyyy-MM-dd');
          const hasAvailability = database.availability.some(
            (value) => value.date === date,
          );
          const summary = summarizeDateState({
            currentUserId: partnerId,
            partnerId: partnerId === 'him' ? 'her' : 'him',
            date,
            availability: database.availability,
            invitations: database.invitations,
            hasPhoto: photoDates.has(date),
            hasNote: database.dailyNotes.some((note) => note.date === date),
          });
          return (
            <button
              type="button"
              className="calendar-day"
              key={date}
              aria-label={format(day, 'M月d日')}
              aria-selected={selectedDate === date}
              disabled={!isSameMonth(day, month)}
              data-has-availability={hasAvailability || undefined}
              data-primary-state={summary.primary}
              data-secondary-states={summary.secondary.join(' ')}
              onClick={() => setSelectedDate(date)}
            >
              {format(day, 'd')}
              <span className="calendar-markers" aria-hidden="true">
                {summary.secondary.map((state) => <i className={`marker marker-${state}`} key={state} />)}
                {summary.hasNote && <i className="marker marker-note" />}
                {summary.hasPhoto && <i className="marker marker-photo" />}
              </span>
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
          photoRepository={photoRepository}
        />
      )}
    </section>
  );
}
