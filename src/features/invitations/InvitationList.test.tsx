import { render, screen, within } from '@testing-library/react';
import { invitationBuilder } from '../../test/builders';
import { InvitationList } from './InvitationList';

it('groups invitations by the current partner relationship to them', () => {
  const invitations = [
    invitationBuilder({ id: 'needs-him', senderId: 'her', recipientId: 'him' }),
    invitationBuilder({ id: 'sent-by-him', senderId: 'him', recipientId: 'her' }),
    invitationBuilder({ id: 'confirmed', status: 'confirmed' }),
    invitationBuilder({ id: 'rejected', status: 'rejected' }),
  ];

  render(
    <InvitationList
      partnerId="him"
      invitations={invitations}
      today="2026-07-18"
      onSelect={vi.fn()}
    />,
  );

  expect(
    within(screen.getByLabelText('待我处理')).getByText('看电影'),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '我发起的' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '已确认' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '历史记录' })).toBeInTheDocument();
});

it('treats an adjustment as waiting for the original sender', () => {
  const adjusted = invitationBuilder({
    status: 'adjustment_pending',
    senderId: 'him',
    recipientId: 'her',
  });

  render(
    <InvitationList
      partnerId="him"
      invitations={[adjusted]}
      today="2026-07-18"
      onSelect={vi.fn()}
    />,
  );

  expect(
    within(screen.getByLabelText('待我处理')).getByText('看电影'),
  ).toBeInTheDocument();
});
