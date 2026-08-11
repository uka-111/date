import { isValid, parseISO } from 'date-fns';
import type { Availability, PartnerId, Period } from './models';

interface AvailabilityInput {
  ownerId: PartnerId;
  date: string;
  periods: Period[];
  note: string;
}

export function createAvailability(
  input: AvailabilityInput,
  now = new Date().toISOString(),
): Availability {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !isValid(parseISO(input.date))) {
    throw new Error('日期格式不正确');
  }
  return {
    id: `${input.ownerId}:${input.date}`,
    ownerId: input.ownerId,
    date: input.date,
    periods: [...new Set(input.periods)],
    note: input.note.trim(),
    updatedAt: now,
  };
}
