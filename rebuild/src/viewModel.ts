type DateMark = 'confirmed' | 'pending' | 'him' | 'her' | 'memory';

export type CalendarMark = {
  label: string;
  marks: DateMark[];
  primary?: DateMark;
};

export type ArrangementView = {
  activity: string;
  location: string;
};

export type RecordViewItem = {
  date: string;
  title: string;
  detail?: string;
  status?: string;
};

export type RecordsViewModel = {
  plans: RecordViewItem[];
  notes: { mine: RecordViewItem[]; partner: RecordViewItem[] };
  photos: { mine: RecordViewItem[]; partner: RecordViewItem[] };
};

type BaseRecords = RecordsViewModel;

function upsertByDate(items: RecordViewItem[], value: RecordViewItem) {
  const existing = items.findIndex((item) => item.date === value.date);
  if (existing === -1) return [...items, value];
  return items.map((item, index) => index === existing ? { ...item, ...value } : item);
}

export function createRecordsViewModel(
  base: BaseRecords,
  arrangements: Record<string, ArrangementView>,
  notes: Record<string, string>,
  photos: Record<string, string[]>,
): RecordsViewModel {
  let plans = [...base.plans];
  let mineNotes = [...base.notes.mine];
  let minePhotos = [...base.photos.mine];

  Object.entries(arrangements).forEach(([date, arrangement]) => {
    if (arrangement.activity === '尚未创建安排') return;
    plans = upsertByDate(plans, {
      date,
      title: arrangement.activity,
      detail: arrangement.location === '未填写' ? '地点待补充' : arrangement.location,
      status: '已确定',
    });
  });

  Object.entries(notes).forEach(([date, body]) => {
    if (!body.trim()) return;
    mineNotes = upsertByDate(mineNotes, { date, title: body });
  });

  Object.entries(photos).forEach(([date, items]) => {
    items.forEach((item, index) => {
      minePhotos.push({ date, title: item.startsWith('blob:') ? `当天照片 ${index + 1}` : item });
    });
  });

  return {
    plans,
    notes: { mine: mineNotes, partner: [...base.notes.partner] },
    photos: { mine: minePhotos, partner: [...base.photos.partner] },
  };
}

export function createCalendarMarks(
  base: Record<string, CalendarMark>,
  arrangements: Record<string, ArrangementView>,
  availability: Record<string, string>,
  notes: Record<string, string>,
  photos: Record<string, string[]>,
): Record<string, CalendarMark> {
  const result = { ...base };
  const addMark = (date: string, mark: CalendarMark) => {
    result[date] = {
      ...result[date],
      ...mark,
      marks: Array.from(new Set([...(result[date]?.marks ?? []), ...mark.marks])),
      label: mark.label || result[date]?.label || '',
    };
  };

  Object.entries(arrangements).forEach(([date, value]) => {
    if (value.activity !== '尚未创建安排') addMark(date, { label: '', marks: ['memory'] });
  });
  Object.entries(availability).forEach(([date, value]) => {
    if (value) addMark(date, { label: value, marks: ['her'] });
  });
  Object.entries(notes).forEach(([date, value]) => {
    if (value.trim()) addMark(date, { label: '', marks: ['memory'] });
  });
  Object.entries(photos).forEach(([date, items]) => {
    if (items.length > 0) addMark(date, { label: '', marks: ['memory'] });
  });

  return result;
}
