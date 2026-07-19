import type { Invitation, InvitationHistoryEntry, Period } from './models';
import type { LocalDatabase } from '../storage/schema';

type LegacyHistoryEntry = Omit<InvitationHistoryEntry, 'proposedPeriods'> & {
  proposedPeriod?: Period;
};
type LegacyInvitation = Omit<Invitation, 'period' | 'periods' | 'history'> & {
  period: Period;
  history: LegacyHistoryEntry[];
};
type LegacyDatabase = {
  version: 1;
  availability: LocalDatabase['availability'];
  invitations: LegacyInvitation[];
  notifications: LocalDatabase['notifications'];
};

export function migrateDatabase(input: LocalDatabase | LegacyDatabase): LocalDatabase {
  if (input.version === 2) return input;

  return {
    version: 2,
    availability: input.availability,
    invitations: input.invitations.map((invitation) => {
      const { period, ...withoutLegacyPeriod } = invitation;
      return {
      ...withoutLegacyPeriod,
      periods: [period],
      history: invitation.history.map((entry) => {
        const { proposedPeriod, ...rest } = entry;
        return {
          ...rest,
          ...(proposedPeriod ? { proposedPeriods: [proposedPeriod] } : {}),
        };
      }),
      };
    }),
    notifications: input.notifications,
    dailyNotes: [],
    viewPreference: 'month',
  };
}
