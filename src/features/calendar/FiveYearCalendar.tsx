export interface MonthDensity { confirmed: number; memories: number; }
export function FiveYearCalendar({ startYear, densities, onSelectMonth }: { startYear: number; densities: Record<string, MonthDensity>; onSelectMonth: (month: string) => void }) {
  return <div className="five-year-calendar">{Array.from({ length: 5 }, (_, offset) => {
    const year = startYear + offset;
    return <section className="year-density" key={year}><h3>{year}</h3><div>{Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`; const value = densities[month] ?? { confirmed: 0, memories: 0 };
      return <button key={month} type="button" aria-label={`${year}年${index + 1}月，${value.confirmed}个已确认行程，${value.memories}个回忆日期`} style={{ '--density': Math.min(value.confirmed, 5) / 5 } as React.CSSProperties} onClick={() => onSelectMonth(month)}><span>{index + 1}月</span>{value.memories > 0 && <small>{value.memories}</small>}</button>;
    })}</div></section>;
  })}</div>;
}
