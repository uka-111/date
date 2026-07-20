import type { Invitation, InvitationHistoryEntry, Period } from './models';
import type { LocalDatabase } from '../storage/schema';

type LegacyV1HistoryEntry = Omit<InvitationHistoryEntry, 'proposedPeriods' | 'proposedActivity'> & {
  proposedPeriod?: Period;
  proposedActivity?: string;
};
type LegacyV1Invitation = Omit<Invitation, 'period' | 'periods' | 'activity' | 'history'> & {
  period: Period;
  activity: string;
  history: LegacyV1HistoryEntry[];
};
type LegacyV1Database = {
  version: 1;
  availability: LocalDatabase['availability'];
  invitations: LegacyV1Invitation[];
  notifications: LocalDatabase['notifications'];
};

type LegacyV2HistoryEntry = Omit<InvitationHistoryEntry, 'proposedActivity'> & {
  proposedActivity?: string;
};
type LegacyV2Invitation = Omit<Invitation, 'activity' | 'history'> & {
  activity: string;
  history: LegacyV2HistoryEntry[];
};
type LegacyV2Database = Omit<LocalDatabase, 'version' | 'invitations'> & {
  version: 2;
  invitations: LegacyV2Invitation[];
};

type MigratableDatabase = LocalDatabase | LegacyV1Database | LegacyV2Database;

function migrateActivity(activity: string): string[] {
  return [activity];
}

export function migrateDatabase(input: MigratableDatabase): LocalDatabase {
  if (input.version === 3) return input;

  if (input.version === 2) {
    return {
      ...input,
      version: 3,
      invitations: input.invitations.map((invitation) => ({
        ...invitation,
        activity: migrateActivity(invitation.activity),
        history: invitation.history.map((entry) => {
          const { proposedActivity, ...rest } = entry;
          return {
            ...rest,
            ...(typeof proposedActivity === 'string'
              ? { proposedActivity: migrateActivity(proposedActivity) }
              : {}),
          };
        }),
      })),
    };
  }

  return {
    version: 3,
    availability: input.availability,
    invitations: input.invitations.map((invitation) => {
      const { period, ...withoutLegacyPeriod } = invitation;
      return {
        ...withoutLegacyPeriod,
        periods: [period],
        activity: migrateActivity(invitation.activity),
        history: invitation.history.map((entry) => {
          const { proposedPeriod, proposedActivity, ...rest } = entry;
          return {
            ...rest,
            ...(proposedPeriod ? { proposedPeriods: [proposedPeriod] } : {}),
            ...(typeof proposedActivity === 'string'
              ? { proposedActivity: migrateActivity(proposedActivity) }
              : {}),
          };
        }),
      };
    }),
    notifications: input.notifications,
    dailyNotes: [],
    viewPreference: 'month',
  };
}
