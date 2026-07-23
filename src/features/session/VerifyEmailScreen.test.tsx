import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyEmailScreen } from './VerifyEmailScreen';

it('shows pending and a stable error when sign out fails', async () => {
  let rejectSignOut!: (error: Error) => void;
  const onSignOut = vi.fn(() => new Promise<void>((_, reject) => {
    rejectSignOut = reject;
  }));
  const user = userEvent.setup();
  render(<VerifyEmailScreen email="me@example.com" onSignOut={onSignOut} />);

  await user.click(screen.getByRole('button', { name: '退出并重新登录' }));
  expect(screen.getByRole('button', { name: '正在退出...' })).toBeDisabled();

  rejectSignOut(new Error('sensitive backend detail'));
  expect(await screen.findByRole('alert')).toHaveTextContent('退出失败，请稍后再试');
});
