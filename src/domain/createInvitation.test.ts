import { createInvitation } from './createInvitation';

it('creates a pending invitation addressed to the other partner', () => {
  const invitation = createInvitation(
    {
      senderId: 'him',
      date: '2026-07-25',
      period: 'evening',
      activity: '看电影',
      note: '  看新上映的电影  ',
    },
    '2026-07-18T10:00:00.000Z',
  );

  expect(invitation.recipientId).toBe('her');
  expect(invitation.status).toBe('pending');
  expect(invitation.note).toBe('看新上映的电影');
  expect(invitation.history[0].action).toBe('created');
});

it('rejects missing date, period, or activity', () => {
  expect(() =>
    createInvitation({
      senderId: 'her',
      date: '',
      period: null,
      activity: '   ',
      note: '',
    }),
  ).toThrow('请完整填写日期、时段和活动');
});
