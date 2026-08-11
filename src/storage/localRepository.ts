import type { DateBookingRepository } from '../app/repository';
import type { Availability, Invitation } from '../domain/models';
import type { CalendarScale, DailyNote } from '../domain/models';
import { migrateDatabase } from '../domain/migrations';
import { emptyDatabase } from './schema';
import type { LocalDatabase, NotificationRecord } from './schema';

const STORAGE_KEY = 'couple-date-booking';

function upsertById<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index === -1) return [...items, value];

  return items.map((item) => (item.id === value.id ? value : item));
}

function isDatabase(value: unknown): value is Parameters<typeof migrateDatabase>[0] {
  if (!value || typeof value !== 'object') return false;
  const database = value as Partial<LocalDatabase>;
  const version = (value as { version?: number }).version;
  return (
    (version === 1 || version === 2 || version === 3) &&
    Array.isArray(database.availability) &&
    Array.isArray(database.invitations) &&
    Array.isArray(database.notifications)
  );
}

export function createLocalRepository(
  storage: Storage,
): DateBookingRepository {
  function read(): LocalDatabase {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored === null) return emptyDatabase();

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isDatabase(parsed)) throw new Error('invalid schema');
      const migrated = migrateDatabase(parsed as Parameters<typeof migrateDatabase>[0]);
      if ((parsed as { version?: number }).version !== 3) write(migrated);
      return migrated;
    } catch {
      throw new Error('本地数据无法读取');
    }
  }

  function write(database: LocalDatabase) {
    storage.setItem(STORAGE_KEY, JSON.stringify(database));
  }

  function saveAvailability(value: Availability) {
    const database = read();
    if (value.periods.length === 0) {
      write({
        ...database,
        availability: database.availability.filter((item) => item.id !== value.id),
      });
      return;
    }
    write({
      ...database,
      availability: upsertById(database.availability, value),
    });
  }

  function saveInvitation(value: Invitation) {
    const database = read();
    write({
      ...database,
      invitations: upsertById(database.invitations, value),
    });
  }

  function saveNotification(value: NotificationRecord) {
    const database = read();
    write({
      ...database,
      notifications: upsertById(database.notifications, value),
    });
  }

  function saveInvitationWithNotification(
    invitation: Invitation,
    notification: NotificationRecord,
  ) {
    const database = read();
    write({
      ...database,
      invitations: upsertById(database.invitations, invitation),
      notifications: upsertById(database.notifications, notification),
    });
  }

  function markNotificationRead(
    id: string,
    partnerId: 'him' | 'her',
    readAt: string,
  ) {
    const database = read();
    write({
      ...database,
      notifications: database.notifications.map((notification) =>
        notification.id === id && notification.recipientId === partnerId
          ? { ...notification, readAt }
          : notification,
      ),
    });
  }

  function saveDailyNote(value: DailyNote) {
    const database = read();
    write({
      ...database,
      dailyNotes: database.dailyNotes.some((note) => note.date === value.date)
        ? database.dailyNotes.map((note) => note.date === value.date ? value : note)
        : [...database.dailyNotes, value],
    });
  }

  function getDailyNote(date: string) {
    return read().dailyNotes.find((note) => note.date === date);
  }

  function deleteDailyNote(date: string) {
    const database = read();
    write({ ...database, dailyNotes: database.dailyNotes.filter((note) => note.date !== date) });
  }

  function saveViewPreference(scale: CalendarScale) {
    const database = read();
    write({ ...database, viewPreference: scale });
  }

  return {
    read,
    saveAvailability,
    saveInvitation,
    saveNotification,
    saveInvitationWithNotification,
    markNotificationRead,
    saveDailyNote,
    getDailyNote,
    deleteDailyNote,
    saveViewPreference,
    reset: () => storage.removeItem(STORAGE_KEY),
  };
}
