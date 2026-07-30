import { useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import type { Availability, PartnerId, Period } from '../../domain/models';
import { AvailabilityEditor } from './AvailabilityEditor';
import { DailyNoteEditor } from '../memories/DailyNoteEditor';
import { PhotoGallery } from '../memories/PhotoGallery';
import type { PhotoRepository } from '../../storage/photoRepository';

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
  photoRepository?: PhotoRepository;
}

export function DayPanel({
  date,
  partnerId,
  availability,
  repository,
  onSaved,
  photoRepository,
}: DayPanelProps) {
  const [memoryOwner, setMemoryOwner] = useState<PartnerId>(partnerId);
  const dayAvailability = availability.filter((value) => value.date === date);
  const ownAvailability = dayAvailability.find(
    (value) => value.ownerId === partnerId,
  );
  const partnerIdToView = partnerId === 'him' ? 'her' : 'him';
  const isOwnMemory = memoryOwner === partnerId;
  const viewedNote = repository.read().dailyNotes.find(
    (note) => note.date === date && note.ownerId === memoryOwner,
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
      <div className="memory-sections">
        <button
          className="memory-owner-switch"
          type="button"
          aria-pressed={isOwnMemory}
          title={`切换到${isOwnMemory ? '对方' : '我的'}当天回忆`}
          onClick={() => setMemoryOwner(isOwnMemory ? partnerIdToView : partnerId)}
        >
          {isOwnMemory ? '我的' : '对方'}
        </button>
        <div className="memory-content">
          {photoRepository && <PhotoGallery date={date} repository={photoRepository} ownerId={memoryOwner} readOnly={!isOwnMemory} onChanged={onSaved} />}
          {isOwnMemory
            ? <DailyNoteEditor date={date} repository={repository} onSaved={onSaved} />
            : <section className="daily-note daily-note-readonly" aria-label="对方当天记录"><h4>当天记录</h4>{viewedNote ? <><span className="note-field-label">记录标题</span><p className="readonly-note-field">{viewedNote.title || '当天记录'}</p><span className="note-field-label">当天记录</span><p className="readonly-note-field readonly-note-body">{viewedNote.body}</p></> : <p>对方当天还没有记录。</p>}</section>}
        </div>
      </div>
    </section>
  );
}
