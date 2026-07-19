import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotificationRecord } from '../../storage/schema';
import { NotificationBell } from './NotificationBell';
import { NotificationList } from './NotificationList';

const notifications: NotificationRecord[] = [
  {
    id: 'one',
    recipientId: 'her',
    invitationId: 'invitation-1',
    kind: 'created',
    createdAt: '2026-07-18T10:00:00.000Z',
    readAt: null,
  },
  {
    id: 'two',
    recipientId: 'her',
    invitationId: 'invitation-2',
    kind: 'adjusted',
    createdAt: '2026-07-18T11:00:00.000Z',
    readAt: null,
  },
  {
    id: 'three',
    recipientId: 'him',
    invitationId: 'invitation-3',
    kind: 'confirmed',
    createdAt: '2026-07-18T12:00:00.000Z',
    readAt: null,
  },
];

it('counts only unread notifications for the current partner', () => {
  render(<NotificationBell partnerId="her" notifications={notifications} onClick={vi.fn()} />);

  expect(screen.getByLabelText('2 条未读提醒')).toBeInTheDocument();
});

it('opens the selected notification', async () => {
  const onOpen = vi.fn();
  render(
    <NotificationList
      partnerId="her"
      notifications={notifications}
      onOpen={onOpen}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /新的约会邀请/ }));

  expect(onOpen).toHaveBeenCalledWith(notifications[0]);
});
