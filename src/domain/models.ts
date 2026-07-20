export type PartnerId = 'him' | 'her';

export type Period = 'all_day' | 'morning' | 'afternoon' | 'evening';

export type InvitationStatus =
  | 'pending'
  | 'adjustment_pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

export interface Availability {
  id: string;
  ownerId: PartnerId;
  date: string;
  periods: Period[];
  note: string;
  updatedAt: string;
}

export type InvitationAction =
  | 'created'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'adjustment_suggested'
  | 'adjustment_accepted';

export interface InvitationHistoryEntry {
  id: string;
  actorId: PartnerId;
  action: InvitationAction;
  createdAt: string;
  note?: string;
  proposedDate?: string;
  proposedPeriods?: Period[];
  proposedActivity?: string[];
}

export interface Invitation {
  id: string;
  senderId: PartnerId;
  recipientId: PartnerId;
  date: string;
  periods: Period[];
  activity: string[];
  note: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
  history: InvitationHistoryEntry[];
}

export type CalendarScale = 'month' | 'year' | 'five_years';

export interface DailyNote {
  date: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
