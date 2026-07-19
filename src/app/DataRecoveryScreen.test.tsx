import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('couple-date-partner', 'him');
  window.history.pushState({}, '', '/');
});

it('lets the user reset only application data after a parse failure', async () => {
  localStorage.setItem('unrelated-setting', 'keep-me');
  localStorage.setItem('couple-date-booking', '{broken');
  const user = userEvent.setup();

  render(<App />);

  expect(
    screen.getByRole('heading', { name: '本地数据无法读取' }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '重置约会数据' }));
  expect(
    screen.getByRole('dialog', { name: '确认重置约会数据吗？' }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '确认重置' }));

  expect(localStorage.getItem('couple-date-booking')).toBeNull();
  expect(localStorage.getItem('unrelated-setting')).toBe('keep-me');
  expect(screen.getByRole('grid', { name: '共享月历' })).toBeInTheDocument();
});
