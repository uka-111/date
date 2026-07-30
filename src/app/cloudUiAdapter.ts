import type { DateBookingRepository as CloudRepository } from './bookingRepository';
import type { BookingSnapshot } from './bookingSnapshot';
import type { DateBookingRepository as LegacyRepository } from './repository';
import type { Invitation, PartnerId } from '../domain/models';

export function createCloudUiAdapter(
  snapshot: BookingSnapshot,
  repository: CloudRepository,
  onChanged: () => void,
  onError: (message: string) => void,
  currentPartnerId: PartnerId,
): LegacyRepository {
  const run = (operation: () => Promise<unknown>) => {
    void operation().then(onChanged).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : '同步失败，请稍后再试');
    });
  };

  const submitInvitation = (invitation: Invitation) => {
    const original = snapshot.invitations.find((item) => item.id === invitation.id);
    if (!original) {
      run(() => repository.createInvitation({ date: invitation.date, periods: invitation.periods, activities: invitation.activity, note: invitation.note }));
      return;
    }
    const latest = invitation.history.at(-1);
    if (!latest) return;
    const response = latest.action === 'confirmed'
      ? { type: original.status === 'adjustment_pending' ? 'accept-adjustment' : 'confirm' } as const
      : latest.action === 'rejected' ? { type: 'reject', note: latest.note } as const
        : latest.action === 'cancelled' ? { type: 'cancel', note: latest.note } as const
          : latest.action === 'adjustment_suggested' ? {
            type: 'suggest-adjustment' as const,
            date: latest.proposedDate ?? invitation.date,
            periods: latest.proposedPeriods ?? invitation.periods,
            activity: latest.proposedActivity ?? invitation.activity,
            note: latest.note,
          } : null;
    if (response) run(() => repository.respondToInvitation(invitation.id, response));
  };

  return {
    read: () => ({ version: 3, ...snapshot }),
    saveAvailability: (value) => run(() => repository.saveAvailability({ date: value.date, periods: value.periods, note: value.note })),
    saveInvitation: submitInvitation,
    saveNotification: () => undefined,
    saveInvitationWithNotification: (invitation) => submitInvitation(invitation),
    markNotificationRead: (id) => run(() => repository.markNotificationRead(id)),
    saveDailyNote: (value) => run(() => repository.saveDailyNote({ date: value.date, title: value.title, body: value.body })),
    getDailyNote: (date) => snapshot.dailyNotes.find(
      (note) => note.date === date && note.ownerId === currentPartnerId,
    ),
    deleteDailyNote: (date) => run(() => repository.deleteDailyNote(date)),
    saveViewPreference: (scale) => run(() => repository.saveViewPreference(scale)),
    reset: () => undefined,
  };
}
