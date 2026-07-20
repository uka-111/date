import { migrateDatabase } from './migrations';

it('migrates a v1 period and activity without changing the invitation identity', () => {
  const migrated = migrateDatabase({
    version: 1,
    availability: [],
    invitations: [{
      id: 'old', senderId: 'him', recipientId: 'her', date: '2026-07-25',
      period: 'evening', activity: '看电影', note: '', status: 'pending',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z',
      history: [{ id: 'h', actorId: 'him', action: 'created', createdAt: '2026-07-18T10:00:00.000Z' }],
    }],
    notifications: [],
  });

  expect(migrated.version).toBe(3);
  expect(migrated.invitations[0].periods).toEqual(['evening']);
  expect(migrated.invitations[0].activity).toEqual(['看电影']);
  expect(migrated.invitations[0].id).toBe('old');
  expect(migrated.invitations[0].history[0].id).toBe('h');
});

it('adds empty daily notes and a month view preference to a migrated database', () => {
  const migrated = migrateDatabase({
    version: 1,
    availability: [],
    invitations: [],
    notifications: [],
  });

  expect(migrated.dailyNotes).toEqual([]);
  expect(migrated.viewPreference).toBe('month');
});

it('migrates v2 activity and history proposed activity to arrays', () => {
  const migrated = migrateDatabase({
    version: 2,
    availability: [],
    invitations: [{
      id: 'v2', senderId: 'him', recipientId: 'her', date: '2026-07-25',
      periods: ['evening'], activity: '看电影', note: '', status: 'pending',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z',
      history: [{
        id: 'h2', actorId: 'her', action: 'adjustment_suggested',
        createdAt: '2026-07-18T10:00:00.000Z', proposedActivity: '逛展',
      }],
    }],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'year',
  });

  expect(migrated.version).toBe(3);
  expect(migrated.invitations[0].activity).toEqual(['看电影']);
  expect(migrated.invitations[0].history[0].proposedActivity).toEqual(['逛展']);
});

it('keeps a v3 database unchanged when migrated again', () => {
  const database = {
    version: 3 as const,
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'year' as const,
  };

  expect(migrateDatabase(database)).toEqual(database);
});
