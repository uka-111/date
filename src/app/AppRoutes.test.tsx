import { render, screen } from '@testing-library/react';
import { createLocalRepository } from '../storage/localRepository';
import { invitationBuilder } from '../test/builders';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('couple-date-partner', 'her');
  window.history.pushState({}, '', '/');
});

it('shows a safe empty state for a missing invitation route', () => {
  window.history.pushState({}, '', '/invitations/missing');

  render(<App />);

  expect(screen.getByText('没有找到这个约会')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回共享日历' })).toHaveAttribute(
    'href',
    '/',
  );
});

it('marks matching notifications as read when invitation details open', () => {
  const repository = createLocalRepository(localStorage);
  const invitation = invitationBuilder();
  repository.saveInvitationWithNotification(invitation, {
    id: 'notification-1',
    recipientId: 'her',
    invitationId: invitation.id,
    kind: 'created',
    createdAt: '2026-07-18T10:00:00.000Z',
    readAt: null,
  });
  window.history.pushState({}, '', `/invitations/${invitation.id}`);

  render(<App />);

  expect(screen.getByRole('heading', { name: '看电影' })).toBeInTheDocument();
  expect(repository.read().notifications[0].readAt).not.toBeNull();
});
