import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { invitationBuilder } from '../../test/builders';
import { InvitationDetails } from './InvitationDetails';

beforeEach(() => {
  localStorage.clear();
});

it('shows response actions only to the recipient', () => {
  const invitation = invitationBuilder({ senderId: 'him', recipientId: 'her' });
  const repository = createLocalRepository(localStorage);
  const { rerender } = render(
    <InvitationDetails
      invitation={invitation}
      partnerId="him"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  expect(
    screen.queryByRole('button', { name: '确认约会' }),
  ).not.toBeInTheDocument();

  rerender(
    <InvitationDetails
      invitation={invitation}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: '确认约会' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '建议调整' })).toBeInTheDocument();
});

it('requires confirmation before rejecting', async () => {
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder()}
      partnerId="her"
      repository={createLocalRepository(localStorage)}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '拒绝' }));

  expect(
    screen.getByRole('dialog', { name: '确认拒绝这个约会吗？' }),
  ).toBeInTheDocument();
});

it('confirms an invitation and notifies the sender', async () => {
  const repository = createLocalRepository(localStorage);
  const onUpdated = vi.fn();
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder()}
      partnerId="her"
      repository={repository}
      onUpdated={onUpdated}
    />,
  );

  await user.click(screen.getByRole('button', { name: '确认约会' }));

  expect(repository.read().invitations[0].status).toBe('confirmed');
  expect(repository.read().notifications[0]).toMatchObject({
    recipientId: 'him',
    kind: 'confirmed',
  });
  expect(onUpdated).toHaveBeenCalled();
});

it('lets the recipient suggest an adjustment without replacing the original', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder()}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  await user.clear(screen.getByLabelText('调整后的日期'));
  await user.type(screen.getByLabelText('调整后的日期'), '2026-07-26');
  await user.click(screen.getByLabelText('调整为下午'));
  await user.clear(screen.getByLabelText('调整后的活动'));
  await user.type(screen.getByLabelText('调整后的活动'), '逛展');
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));

  const saved = repository.read().invitations[0];
  expect(saved.date).toBe('2026-07-25');
  expect(saved.status).toBe('adjustment_pending');
  expect(saved.history.at(-1)?.proposedDate).toBe('2026-07-26');
});
