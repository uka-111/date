import { invitationBuilder } from '../test/builders';
import { createLocalRepository } from './localRepository';

beforeEach(() => {
  localStorage.clear();
});

it('returns an empty versioned database when storage is empty', () => {
  const repository = createLocalRepository(localStorage);

  expect(repository.read()).toEqual({
    version: 3,
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  });
});

it('migrates v1 data on read and persists it once', () => {
  localStorage.setItem('couple-date-booking', JSON.stringify({
    version: 1,
    availability: [],
    invitations: [{
      ...invitationBuilder(),
      periods: undefined,
      period: 'evening',
      activity: '看电影',
    }],
    notifications: [],
  }));
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const repository = createLocalRepository(localStorage);

  expect(repository.read().invitations[0].periods).toEqual(['evening']);
  expect(setItem).toHaveBeenCalledTimes(1);
  repository.read();
  expect(setItem).toHaveBeenCalledTimes(1);
  setItem.mockRestore();
});

it('migrates v2 data on first read and writes back v3 data', () => {
  localStorage.setItem('couple-date-booking', JSON.stringify({
    version: 2,
    availability: [],
    invitations: [{ ...invitationBuilder(), activity: '看电影' }],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  }));
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const repository = createLocalRepository(localStorage);

  expect(repository.read().version).toBe(3);
  expect(setItem).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('couple-date-booking')!).version).toBe(3);
  setItem.mockRestore();
});

it('does not write back data already at v3', () => {
  localStorage.setItem('couple-date-booking', JSON.stringify({
    version: 3,
    availability: [],
    invitations: [],
    notifications: [],
    dailyNotes: [],
    viewPreference: 'month',
  }));
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const repository = createLocalRepository(localStorage);

  expect(repository.read().version).toBe(3);
  expect(setItem).not.toHaveBeenCalled();
  setItem.mockRestore();
});

it('saves one daily note per date and persists the calendar scale', () => {
  const repository = createLocalRepository(localStorage);
  repository.saveDailyNote({
    date: '2026-07-25',
    title: '日落',
    body: '风很舒服',
    createdAt: '2026-07-25T10:00:00.000Z',
    updatedAt: '2026-07-25T10:00:00.000Z',
  });
  repository.saveViewPreference('year');

  expect(repository.getDailyNote('2026-07-25')?.title).toBe('日落');
  expect(repository.read().viewPreference).toBe('year');

  repository.deleteDailyNote('2026-07-25');
  expect(repository.getDailyNote('2026-07-25')).toBeUndefined();
});

it('keeps two invitations in the same date period', () => {
  const repository = createLocalRepository(localStorage);

  repository.saveInvitation(invitationBuilder({ id: 'one' }));
  repository.saveInvitation(invitationBuilder({ id: 'two' }));

  expect(repository.read().invitations).toHaveLength(2);
});

it('saves an invitation and its notification in one database write', () => {
  const repository = createLocalRepository(localStorage);
  const setItem = vi.spyOn(Storage.prototype, 'setItem');

  repository.saveInvitationWithNotification(
    invitationBuilder(),
    {
      id: 'notification-1',
      recipientId: 'her',
      invitationId: 'invitation-1',
      kind: 'created',
      createdAt: '2026-07-18T10:00:00.000Z',
      readAt: null,
    },
  );

  expect(setItem).toHaveBeenCalledTimes(1);
  expect(repository.read().invitations).toHaveLength(1);
  expect(repository.read().notifications).toHaveLength(1);
});

it('marks only the matching partner notification as read', () => {
  const repository = createLocalRepository(localStorage);
  repository.saveNotification({
    id: 'notification-1',
    recipientId: 'her',
    invitationId: 'invitation-1',
    kind: 'created',
    createdAt: '2026-07-18T10:00:00.000Z',
    readAt: null,
  });

  repository.markNotificationRead(
    'notification-1',
    'him',
    '2026-07-18T11:00:00.000Z',
  );
  expect(repository.read().notifications[0].readAt).toBeNull();

  repository.markNotificationRead(
    'notification-1',
    'her',
    '2026-07-18T11:00:00.000Z',
  );
  expect(repository.read().notifications[0].readAt).toBe(
    '2026-07-18T11:00:00.000Z',
  );
});

it('offers a reset path for invalid stored JSON', () => {
  localStorage.setItem('couple-date-booking', '{broken');
  const repository = createLocalRepository(localStorage);

  expect(() => repository.read()).toThrow('本地数据无法读取');

  repository.reset();
  expect(repository.read().version).toBe(3);
});
