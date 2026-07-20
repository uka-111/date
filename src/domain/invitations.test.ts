import { respondToInvitation } from './invitations';
import { invitationBuilder } from '../test/builders';

it('allows only the recipient to confirm', () => {
  const invitation = invitationBuilder();

  expect(() =>
    respondToInvitation(invitation, 'him', { type: 'confirm' }),
  ).toThrow('只有接收方可以确认这个约会');

  expect(
    respondToInvitation(invitation, 'her', { type: 'confirm' }).status,
  ).toBe('confirmed');
});

it('preserves the original proposal when an adjustment is suggested', () => {
  const result = respondToInvitation(invitationBuilder(), 'her', {
    type: 'suggest-adjustment',
    date: '2026-07-26',
    periods: ['afternoon', 'evening'],
    activity: ['逛展'],
    note: '下午人少一点',
  });

  expect(result.date).toBe('2026-07-25');
  expect(result.status).toBe('adjustment_pending');
  expect(result.history.at(-1)?.proposedDate).toBe('2026-07-26');
});

it('applies the latest adjustment when the original sender accepts it', () => {
  const adjusted = respondToInvitation(invitationBuilder(), 'her', {
    type: 'suggest-adjustment',
    date: '2026-07-26',
    periods: ['afternoon', 'evening'],
    activity: ['逛展'],
  });

  const confirmed = respondToInvitation(adjusted, 'him', {
    type: 'accept-adjustment',
  });

  expect(confirmed).toMatchObject({
    date: '2026-07-26',
    periods: ['afternoon', 'evening'],
    activity: ['逛展'],
    status: 'confirmed',
  });
});

it('does not share activity arrays with the source invitation or adjustment history', () => {
  const invitation = invitationBuilder({ activity: ['看电影'] });
  const confirmed = respondToInvitation(invitation, 'her', { type: 'confirm' });

  confirmed.activity.push('吃晚饭');
  expect(invitation.activity).toEqual(['看电影']);

  const adjusted = respondToInvitation(invitationBuilder(), 'her', {
    type: 'suggest-adjustment',
    date: '2026-07-26',
    periods: ['afternoon'],
    activity: ['逛展'],
  });
  const accepted = respondToInvitation(adjusted, 'him', { type: 'accept-adjustment' });

  accepted.activity.push('喝咖啡');
  expect(adjusted.history.at(-1)?.proposedActivity).toEqual(['逛展']);
});

it('normalizes multiple suggested activities and applies them in order', () => {
  const invitation = invitationBuilder({ activity: ['看电影'] });
  const suggestedActivities = [' 逛展 ', '一起吃饭', '逛展', ' '];

  const adjusted = respondToInvitation(invitation, 'her', {
    type: 'suggest-adjustment',
    date: '2026-07-26',
    periods: ['afternoon'],
    activity: suggestedActivities,
  });

  expect(adjusted.activity).toEqual(['看电影']);
  expect(adjusted.history.at(-1)?.proposedActivity).toEqual([
    '逛展',
    '一起吃饭',
  ]);
  expect(invitation.activity).toEqual(['看电影']);
  expect(suggestedActivities).toEqual([' 逛展 ', '一起吃饭', '逛展', ' ']);

  const accepted = respondToInvitation(adjusted, 'him', {
    type: 'accept-adjustment',
  });

  expect(accepted.activity).toEqual(['逛展', '一起吃饭']);
  expect(accepted.activity).not.toBe(adjusted.history.at(-1)?.proposedActivity);
});

it.each([{ activity: [] }, { activity: ['  ', '\t'] }])(
  'rejects an adjustment without a non-empty activity: %j',
  ({ activity }) => {
    expect(() =>
      respondToInvitation(invitationBuilder(), 'her', {
        type: 'suggest-adjustment',
        date: '2026-07-26',
        periods: ['afternoon'],
        activity,
      }),
    ).toThrow('请至少选择一个活动');
  },
);

it('prevents changes after an invitation is rejected', () => {
  const rejected = invitationBuilder({ status: 'rejected' });

  expect(() =>
    respondToInvitation(rejected, 'her', { type: 'confirm' }),
  ).toThrow('这个约会已经结束，不能再次修改');
});
