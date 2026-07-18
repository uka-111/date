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
    period: 'afternoon',
    activity: '逛展',
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
    period: 'afternoon',
    activity: '逛展',
  });

  const confirmed = respondToInvitation(adjusted, 'him', {
    type: 'accept-adjustment',
  });

  expect(confirmed).toMatchObject({
    date: '2026-07-26',
    period: 'afternoon',
    activity: '逛展',
    status: 'confirmed',
  });
});

it('prevents changes after an invitation is rejected', () => {
  const rejected = invitationBuilder({ status: 'rejected' });

  expect(() =>
    respondToInvitation(rejected, 'her', { type: 'confirm' }),
  ).toThrow('这个约会已经结束，不能再次修改');
});
