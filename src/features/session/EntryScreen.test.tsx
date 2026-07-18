import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

it('shows the shared calendar after identity selection', () => {
  sessionStorage.setItem('couple-date-partner', 'him');

  render(<App />);

  expect(screen.getByRole('grid', { name: '共享月历' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '发起约会' })).toHaveAttribute(
    'href',
    '/invite',
  );
});

it('requires the shared passphrase before identity selection', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText('专属口令'), 'wrong');
  await user.click(screen.getByRole('button', { name: '进入我们的日历' }));

  expect(screen.getByText('口令不正确')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '我是她' }),
  ).not.toBeInTheDocument();
});

it('remembers the selected partner in session storage', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText('专属口令'), '2021121');
  await user.click(screen.getByRole('button', { name: '进入我们的日历' }));
  await user.click(screen.getByRole('button', { name: '我是她' }));

  expect(sessionStorage.getItem('couple-date-partner')).toBe('her');
  expect(screen.getByText('当前身份：她')).toBeInTheDocument();
});

it('can switch back to identity selection without storing the passphrase', async () => {
  sessionStorage.setItem('couple-date-partner', 'him');
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '切换身份' }));

  expect(sessionStorage.getItem('couple-date-partner')).toBeNull();
  expect(sessionStorage.getItem('couple-date-passphrase')).toBeNull();
  expect(screen.getByLabelText('专属口令')).toBeInTheDocument();
});
