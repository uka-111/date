import type { CalendarScale } from '../../domain/models';

export function CalendarScaleControl({ scale, onChange }: { scale: CalendarScale; onChange: (scale: CalendarScale) => void }) {
  return <div className="scale-control" role="group" aria-label="日历尺度">
    {([['month', '月'], ['year', '年'], ['five_years', '5年']] as const).map(([value, label]) =>
      <button key={value} type="button" aria-pressed={scale === value} onClick={() => onChange(value)}>{label}</button>)}
  </div>;
}
