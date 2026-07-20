import { createInvitation } from './createInvitation';

it('creates a pending invitation addressed to the other partner', () => {
  const invitation = createInvitation(
    {
      senderId: 'him',
      date: '2026-07-25',
      periods: ['evening'],
      activity: ['看电影'],
      note: '  看新上映的电影  ',
    },
    '2026-07-18T10:00:00.000Z',
  );

  expect(invitation.recipientId).toBe('her');
  expect(invitation.status).toBe('pending');
  expect(invitation.note).toBe('看新上映的电影');
  expect(invitation.history[0].action).toBe('created');
});

it('rejects missing date, period, or an empty activity list', () => {
  expect(() =>
    createInvitation({
      senderId: 'her',
      date: '2026-07-25',
      periods: ['morning'],
      activity: [],
      note: '',
    }),
  ).toThrow('请完整填写日期、时段和活动');
});

it('rejects an activity list containing only whitespace', () => {
  expect(() =>
    createInvitation({
      senderId: 'her',
      date: '2026-07-25',
      periods: ['morning'],
      activity: ['   ', '  '],
      note: '',
    }),
  ).toThrow('请完整填写日期、时段和活动');
});

it('creates an invitation with every selected period in order', () => {
  const invitation = createInvitation({
    senderId: 'him', date: '2026-07-25', periods: ['morning', 'evening', 'morning'],
    activity: ['看电影'], note: '',
  });

  expect(invitation.periods).toEqual(['morning', 'evening']);
});

it('normalizes activities by trimming, removing blanks, and preserving first occurrences', () => {
  const invitation = createInvitation({
    senderId: 'him',
    date: '2026-07-25',
    periods: ['evening'],
    activity: [' 看电影 ', '一起吃饭', '看电影', '  '],
    note: '',
  });

  expect(invitation.activity).toEqual(['看电影', '一起吃饭']);
});
