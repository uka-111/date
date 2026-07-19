import { addYears, eachDayOfInterval, format, subYears } from 'date-fns';
import { useMemo, useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import { summarizeDateState, type DateSummary } from '../../domain/dateState';
import type { CalendarScale, PartnerId } from '../../domain/models';
import type { PhotoRepository } from '../../storage/photoRepository';
import { CalendarScaleControl } from './CalendarScaleControl';
import { FiveYearCalendar, type MonthDensity } from './FiveYearCalendar';
import { MonthCalendar } from './MonthCalendar';
import { YearCalendar } from './YearCalendar';

export function CalendarWorkspace({ repository, partnerId, photoRepository }: { repository: DateBookingRepository; partnerId: PartnerId; photoRepository?: PhotoRepository }) {
  const database = repository.read();
  const [scale, setScale] = useState<CalendarScale>(database.viewPreference);
  const [anchor, setAnchor] = useState(() => new Date());
  const summaries = useMemo(() => {
    const result: Record<string, DateSummary> = {};
    for (const day of eachDayOfInterval({ start: subYears(anchor, 5), end: addYears(anchor, 5) })) {
      const date = format(day, 'yyyy-MM-dd');
      result[date] = summarizeDateState({ currentUserId: partnerId, partnerId: partnerId === 'him' ? 'her' : 'him', date, availability: database.availability, invitations: database.invitations, hasPhoto: false, hasNote: database.dailyNotes.some((note) => note.date === date) });
    }
    return result;
  }, [anchor, database, partnerId]);
  const changeScale = (value: CalendarScale) => { setScale(value); repository.saveViewPreference(value); };
  const monthDensities = useMemo<Record<string, MonthDensity>>(() => {
    const output: Record<string, MonthDensity> = {};
    for (const invitation of database.invitations.filter((item) => item.status === 'confirmed')) {
      const month = invitation.date.slice(0, 7); output[month] ??= { confirmed: 0, memories: 0 }; output[month].confirmed += 1;
    }
    for (const note of database.dailyNotes) { const month = note.date.slice(0, 7); output[month] ??= { confirmed: 0, memories: 0 }; output[month].memories += 1; }
    return output;
  }, [database]);
  const year = anchor.getFullYear();
  return <section className="calendar-workspace"><CalendarScaleControl scale={scale} onChange={changeScale} />
    {scale === 'month' && <MonthCalendar key={format(anchor, 'yyyy-MM')} initialMonth={format(anchor, 'yyyy-MM')} repository={repository} partnerId={partnerId} photoRepository={photoRepository} />}
    {scale === 'year' && <><div className="calendar-header"><button type="button" aria-label="上一年" onClick={() => setAnchor((value) => subYears(value, 1))}>‹</button><h2>{year}年</h2><button type="button" aria-label="下一年" onClick={() => setAnchor((value) => addYears(value, 1))}>›</button></div><YearCalendar year={year} summaries={summaries} onSelectDate={(date) => { setAnchor(new Date(`${date}T00:00:00`)); changeScale('month'); }} /></>}
    {scale === 'five_years' && <><div className="calendar-header"><button type="button" aria-label="前五年" onClick={() => setAnchor((value) => subYears(value, 5))}>‹</button><h2>{year}-{year + 4}</h2><button type="button" aria-label="后五年" onClick={() => setAnchor((value) => addYears(value, 5))}>›</button></div><FiveYearCalendar startYear={year} densities={monthDensities} onSelectMonth={(month) => { setAnchor(new Date(`${month}-01T00:00:00`)); changeScale('month'); }} /></>}
  </section>;
}
