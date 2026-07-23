import type { Availability, CalendarScale, DailyNote, Invitation } from '../domain/models';
import type { NotificationRecord } from '../storage/schema';

export interface BookingSnapshot {
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
  dailyNotes: DailyNote[];
  viewPreference: CalendarScale;
}

export function emptyBookingSnapshot(): BookingSnapshot {
  return {
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  };
}
