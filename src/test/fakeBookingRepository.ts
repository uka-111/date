import type { DateBookingRepository } from '../app/bookingRepository';
import { emptyBookingSnapshot, type BookingSnapshot } from '../app/bookingSnapshot';
import { respondToInvitation } from '../domain/invitations';
import type { CalendarScale, PartnerId } from '../domain/models';

export function createFakeBookingRepository(
  initial: Partial<BookingSnapshot> = {},
  currentUserId: PartnerId = 'him',
): DateBookingRepository & { failNext(message: string): void } {
  let snapshot: BookingSnapshot = { ...emptyBookingSnapshot(), ...initial };
  let nextFailure: Error | null = null;
  const subscribers = new Set<() => void>();

  function clone() {
    return structuredClone(snapshot);
  }

  function consumeFailure() {
    const failure = nextFailure;
    nextFailure = null;
    if (failure) throw failure;
  }

  function commit(next: BookingSnapshot) {
    snapshot = next;
    subscribers.forEach((subscriber) => subscriber());
  }

  return {
    async load() {
      consumeFailure();
      return clone();
    },
    async saveAvailability(input) {
      consumeFailure();
      const updatedAt = new Date().toISOString();
      const availability = snapshot.availability.filter(
        (value) => !(value.ownerId === currentUserId && value.date === input.date),
      );
      if (input.periods.length === 0) {
        commit({ ...snapshot, availability });
        return;
      }
      commit({
        ...snapshot,
        availability: [...availability, {
          id: `${currentUserId}-${input.date}`,
          ownerId: currentUserId,
          date: input.date,
          periods: [...input.periods],
          note: input.note,
          updatedAt,
        }],
      });
    },
    async createInvitation(input) {
      consumeFailure();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const recipientId = currentUserId === 'him' ? 'her' : 'him';
      commit({
        ...snapshot,
        invitations: [...snapshot.invitations, {
          id,
          senderId: currentUserId,
          recipientId,
          date: input.date,
          periods: [...input.periods],
          activity: [...input.activities],
          note: input.note,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          history: [{ id: `${id}-created`, actorId: currentUserId, action: 'created', createdAt: now }],
        }],
      });
      return id;
    },
    async respondToInvitation(id, response) {
      consumeFailure();
      const invitation = snapshot.invitations.find((item) => item.id === id);
      if (!invitation) throw new Error('未找到这个约会');
      const updated = respondToInvitation(invitation, currentUserId, response);
      commit({
        ...snapshot,
        invitations: snapshot.invitations.map((item) => item.id === id ? updated : item),
      });
    },
    async markNotificationRead(id) {
      consumeFailure();
      commit({
        ...snapshot,
        notifications: snapshot.notifications.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      });
    },
    async saveDailyNote(input) {
      consumeFailure();
      const now = new Date().toISOString();
      const existing = snapshot.dailyNotes.find((note) => note.date === input.date);
      const note = { date: input.date, title: input.title, body: input.body, createdAt: existing?.createdAt ?? now, updatedAt: now };
      commit({ ...snapshot, dailyNotes: [...snapshot.dailyNotes.filter((item) => item.date !== input.date), note] });
    },
    async deleteDailyNote(date) {
      consumeFailure();
      commit({ ...snapshot, dailyNotes: snapshot.dailyNotes.filter((note) => note.date !== date) });
    },
    async saveViewPreference(scale: CalendarScale) {
      consumeFailure();
      commit({ ...snapshot, viewPreference: scale });
    },
    subscribe(onChange) {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    failNext(message) {
      nextFailure = new Error(message);
    },
  };
}
