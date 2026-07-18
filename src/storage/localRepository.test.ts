import { invitationBuilder } from '../test/builders';
import { createLocalRepository } from './localRepository';

beforeEach(() => {
  localStorage.clear();
});

it('returns an empty versioned database when storage is empty', () => {
  const repository = createLocalRepository(localStorage);

  expect(repository.read()).toEqual({
    version: 1,
    availability: [],
    invitations: [],
    notifications: [],
  });
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
  expect(repository.read().version).toBe(1);
});
