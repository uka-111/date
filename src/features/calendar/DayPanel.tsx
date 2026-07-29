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
        <div className="memory-owner-switch" aria-label="当天回忆查看对象">
          <button type="button" aria-pressed={isOwnMemory} onClick={() => setMemoryOwner(partnerId)}>我的</button>
          <button type="button" aria-pressed={!isOwnMemory} onClick={() => setMemoryOwner(partnerIdToView)}>对方</button>
        </div>
        {photoRepository && <PhotoGallery date={date} repository={photoRepository} onChanged={onSaved} />}
        {isOwnMemory
          ? <DailyNoteEditor date={date} repository={repository} onSaved={onSaved} />
          : <section className="daily-note daily-note-readonly" aria-label="对方当天记录"><h4>当天记录</h4>{viewedNote ? <><h5>{viewedNote.title || '当天记录'}</h5><p>{viewedNote.body}</p></> : <p>对方当天还没有记录。</p>}</section>}
      </div>
    </section>
  );
}
