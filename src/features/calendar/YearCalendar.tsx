import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';
import type { DateSummary } from '../../domain/dateState';

export function YearCalendar({ year, summaries, onSelectDate }: { year: number; summaries: Record<string, DateSummary>; onSelectDate: (date: string) => void }) {
  return <div className="year-calendar">{Array.from({ length: 12 }, (_, monthIndex) => {
    const start = new Date(year, monthIndex, 1);
    const leading = (start.getDay() + 6) % 7;
    const days = eachDayOfInterval({ start: startOfMonth(start), end: endOfMonth(start) });
    return <section className="compact-month" key={monthIndex}><h3>{monthIndex + 1}月</h3><div className="compact-grid" style={{ '--leading': leading } as React.CSSProperties}>{days.map((day, index) => {
      const date = format(day, 'yyyy-MM-dd'); const summary = summaries[date];
      return <button style={index === 0 ? { gridColumnStart: leading + 1 } : undefined} key={date} type="button" aria-label={`${year}年${monthIndex + 1}月${day.getDate()}日`} data-primary-state={summary?.primary} onClick={() => onSelectDate(date)}>{day.getDate()}</button>;
    })}</div></section>;
  })}</div>;
}
