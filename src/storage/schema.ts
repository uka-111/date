import type { Availability, Invitation, PartnerId } from '../domain/models';

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
  version: 1;
  availability: Availability[];
  invitations: Invitation[];
  notifications: NotificationRecord[];
}

export function emptyDatabase(): LocalDatabase {
  return {
    version: 1,
    availability: [],
    invitations: [],
    notifications: [],
  };
}
