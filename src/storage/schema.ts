import type { Availability, CalendarScale, DailyNote, Invitation, PartnerId } from '../domain/models';

export type NotificationKind =
  | 'created'
  | 'adjusted'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

export interface NotificationRecord {
  id: string;
  recipientId: PartnerId;
  invitationId: string;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
}

export interface LocalDatabase {
  version: 3;
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
  dailyNotes: DailyNote[];
  viewPreference: CalendarScale;
}

export function emptyDatabase(): LocalDatabase {
  return {
    version: 3,
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  };
}
