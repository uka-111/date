import type { DateBookingRepository } from '../app/repository';
import type { Availability, Invitation } from '../domain/models';
import { emptyDatabase } from './schema';
import type { LocalDatabase, NotificationRecord } from './schema';

const STORAGE_KEY = 'couple-date-booking';

function upsertById<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index === -1) return [...items, value];

  return items.map((item) => (item.id === value.id ? value : item));
}

function isDatabase(value: unknown): value is LocalDatabase {
  if (!value || typeof value !== 'object') return false;
  const database = value as Partial<LocalDatabase>;
  return (
    database.version === 1 &&
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
      return parsed;
    } catch {
      throw new Error('本地数据无法读取');
    }
  }

  function write(database: LocalDatabase) {
    storage.setItem(STORAGE_KEY, JSON.stringify(database));
  }

  function saveAvailability(value: Availability) {
    const database = read();
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

  return {
    read,
    saveAvailability,
    saveInvitation,
    saveNotification,
    saveInvitationWithNotification,
    markNotificationRead,
    reset: () => storage.removeItem(STORAGE_KEY),
  };
}
