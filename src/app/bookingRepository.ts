import type { CalendarScale, Period } from '../domain/models';
import type { InvitationResponse } from '../domain/invitations';
import type { BookingSnapshot } from './bookingSnapshot';

export interface DateBookingRepository {
  load(): Promise<BookingSnapshot>;
  saveAvailability(input: { date: string; periods: Period[]; note: string }): Promise<void>;
  createInvitation(input: { date: string; periods: Period[]; activities: string[]; note: string }): Promise<string>;
  respondToInvitation(id: string, response: InvitationResponse): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  saveDailyNote(input: { date: string; title: string; body: string }): Promise<void>;
  deleteDailyNote(date: string): Promise<void>;
  saveViewPreference(scale: CalendarScale): Promise<void>;
  subscribe(onChange: () => void): () => void;
}
