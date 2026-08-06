import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

it('provides keyboard-accessible primary navigation', () => {
  render(
    <MemoryRouter>
      <AppShell
        partnerId="him"
        notifications={[]}
        onNotificationClick={vi.fn()}
        onSignOut={vi.fn()}
      >
        <p>页面内容</p>
      </AppShell>
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('navigation', { name: '主要导航' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '发起邀请' })).toHaveAttribute(
    'href',
    '/invite',
  );
  expect(screen.getByRole('link', { name: '我的安排' })).toHaveAttribute(
    'href',
    '/invitations',
  );
});
