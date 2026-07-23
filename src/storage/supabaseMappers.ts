import type { BookingSnapshot } from '../app/bookingSnapshot';
import type { Availability, CalendarScale, Invitation, InvitationAction, InvitationStatus, PartnerId, Period } from '../domain/models';
import type { NotificationKind, NotificationRecord } from './schema';

type AvailabilityRow = { id: string; owner_id: string; date: string; periods: string[]; note: string; updated_at: string; [key: string]: unknown };
type InvitationRow = { id: string; sender_id: string; recipient_id: string; date: string; periods: string[]; activities: string[]; note: string; status: string; created_at: string; updated_at: string; [key: string]: unknown };
type EventRow = { id: string; invitation_id: string; actor_id: string; action: string; note: string | null; proposed_date: string | null; proposed_periods: string[] | null; proposed_activities: string[] | null; created_at: string; [key: string]: unknown };
type NotificationRow = { id: string; recipient_id: string; invitation_id: string; kind: string; created_at: string; read_at: string | null; [key: string]: unknown };
type DailyNoteRow = { date: string; title: string; body: string; created_at: string; updated_at: string; [key: string]: unknown };
type PreferenceRow = { calendar_scale: string; [key: string]: unknown } | null;

export interface SupabaseSnapshotRows {
  availabilities: AvailabilityRow[];
  invitations: InvitationRow[];
  events: EventRow[];
  notifications: NotificationRow[];
  dailyNotes: DailyNoteRow[];
  preference: PreferenceRow;
}

function unsupported(): never {
  throw new Error('云端数据格式不受支持');
}

function partnerId(value: string, identities: Map<string, PartnerId>) {
  return identities.get(value) ?? unsupported();
}

function periods(values: string[]): Period[] {
  if (!values.every((value): value is Period => ['all_day', 'morning', 'afternoon', 'evening'].includes(value))) unsupported();
  return [...values] as Period[];
}

function invitationStatus(value: string): InvitationStatus {
  if (!['pending', 'adjustment_pending', 'confirmed', 'rejected', 'cancelled'].includes(value)) unsupported();
  return value as InvitationStatus;
}

function invitationAction(value: string): InvitationAction {
  if (!['created', 'confirmed', 'rejected', 'cancelled', 'adjustment_suggested', 'adjustment_accepted'].includes(value)) unsupported();
  return value as InvitationAction;
}

function notificationKind(value: string): NotificationKind {
  if (!['created', 'adjusted', 'confirmed', 'rejected', 'cancelled'].includes(value)) unsupported();
  return value as NotificationKind;
}

export function mapAvailability(row: AvailabilityRow, identities: Map<string, PartnerId>): Availability {
  return { id: row.id, ownerId: partnerId(row.owner_id, identities), date: row.date, periods: periods(row.periods), note: row.note, updatedAt: row.updated_at };
}

export function mapInvitation(row: InvitationRow, events: EventRow[], identities: Map<string, PartnerId>): Invitation {
  return {
    id: row.id,
    senderId: partnerId(row.sender_id, identities),
    recipientId: partnerId(row.recipient_id, identities),
    date: row.date,
    periods: periods(row.periods),
    activity: [...row.activities],
    note: row.note,
    status: invitationStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history: events
      .filter((event) => event.invitation_id === row.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({
        id: event.id,
        actorId: partnerId(event.actor_id, identities),
        action: invitationAction(event.action),
        createdAt: event.created_at,
        note: event.note ?? undefined,
        proposedDate: event.proposed_date ?? undefined,
        proposedPeriods: event.proposed_periods ? periods(event.proposed_periods) : undefined,
        proposedActivity: event.proposed_activities ? [...event.proposed_activities] : undefined,
      })),
  };
}

export function mapNotification(row: NotificationRow, identities: Map<string, PartnerId>): NotificationRecord {
  return { id: row.id, recipientId: partnerId(row.recipient_id, identities), invitationId: row.invitation_id, kind: notificationKind(row.kind), createdAt: row.created_at, readAt: row.read_at };
}

export function mapDailyNote(row: DailyNoteRow) {
  return { date: row.date, title: row.title, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function mapSnapshot(rows: SupabaseSnapshotRows, identities: Map<string, PartnerId>): BookingSnapshot {
  const scale = rows.preference?.calendar_scale ?? 'month';
  if (!['month', 'year', 'five_years'].includes(scale)) unsupported();
  return {
    availability: rows.availabilities.map((row) => mapAvailability(row, identities)),
    invitations: rows.invitations.map((row) => mapInvitation(row, rows.events, identities)),
    notifications: rows.notifications.map((row) => mapNotification(row, identities)),
    dailyNotes: rows.dailyNotes.map(mapDailyNote),
    viewPreference: scale as CalendarScale,
  };
}
