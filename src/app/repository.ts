import type { Availability, Invitation, PartnerId } from '../domain/models';
import type {
  LocalDatabase,
  NotificationRecord,
} from '../storage/schema';

export interface DateBookingRepository {
  read(): LocalDatabase;
  saveAvailability(value: Availability): void;
  saveInvitation(value: Invitation): void;
  saveNotification(value: NotificationRecord): void;
  saveInvitationWithNotification(
    invitation: Invitation,
    notification: NotificationRecord,
  ): void;
  markNotificationRead(
    id: string,
    partnerId: PartnerId,
    readAt: string,
  ): void;
  reset(): void;
}
