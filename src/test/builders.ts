import type { Invitation } from '../domain/models';

export function invitationBuilder(
  overrides: Partial<Invitation> = {},
): Invitation {
  return {
    id: 'invitation-1',
    senderId: 'him',
    recipientId: 'her',
    date: '2026-07-25',
    periods: ['evening'],
    activity: ['看电影'],
    note: '看新上映的电影',
    status: 'pending',
    createdAt: '2026-07-18T10:00:00.000Z',
    updatedAt: '2026-07-18T10:00:00.000Z',
    history: [
      {
        id: 'history-1',
        actorId: 'him',
        action: 'created',
        createdAt: '2026-07-18T10:00:00.000Z',
      },
    ],
    ...overrides,
  };
}
