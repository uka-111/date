import type { CalendarScale } from '../../domain/models';
import { useEffect, useState } from 'react';

interface CalendarQuickJumpProps {
  scale: CalendarScale;
  anchor: Date;
  open: boolean;
  onChange: (date: Date) => void;
  onComplete?: (date: Date) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function CalendarQuickJump({ scale, anchor, open, onChange, onComplete }: CalendarQuickJumpProps) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState(month);
  useEffect(() => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, [year, month]);
  if (!open) return null;
  const years = Array.from({ length: 21 }, (_, index) => year - 10 + index);
  const selectYear = (value: string) => {
    const nextYear = Number(value);
    setSelectedYear(nextYear);
    onChange(new Date(nextYear, selectedMonth - 1, 1));
  };
  const selectMonth = (value: string) => {
    const nextMonth = Number(value);
    setSelectedMonth(nextMonth);
    const nextDate = new Date(selectedYear, nextMonth - 1, 1);
    onChange(nextDate);
    onComplete?.(nextDate);
  };

  return (
    <div id="calendar-quick-jump" className="calendar-quick-jump" aria-label="快速定位">
      {scale === 'month' ? (
        <>
          <label>
            年份
            <select value={selectedYear} onChange={(event) => selectYear(event.target.value)}>
              {years.map((option) => <option value={option} key={option}>{option}年</option>)}
            </select>
          </label>
          <label>
            月份
            <select value={selectedMonth} onChange={(event) => selectMonth(event.target.value)}>
              {MONTHS.map((option) => <option value={option} key={option}>{option}月</option>)}
            </select>
          </label>
        </>
      ) : (
        <label>
          {scale === 'five_years' ? '五年区间起始年份' : '年份'}
          <select value={year} onChange={(event) => onChange(new Date(Number(event.target.value), 0, 1))}>
            {years.map((option) => <option value={option} key={option}>{option}年</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
