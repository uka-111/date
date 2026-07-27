import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './AuthScreen';

it('starts on login with persistent login enabled and correct autocomplete', () => {
  render(<AuthScreen onSignIn={vi.fn()} onSignUp={vi.fn()} />);

  expect(screen.getByRole('tab', { name: '登录' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('保持登录')).toBeChecked();
  expect(screen.getByLabelText('邮箱')).toHaveAttribute('autocomplete', 'email');
  expect(screen.getByLabelText('密码')).toHaveAttribute('autocomplete', 'current-password');
});

it('disables submission while login is pending and preserves email after failure', async () => {
  let reject!: (error: Error) => void;
  const onSignIn = vi.fn(() => new Promise<void>((_, rejectPromise) => (reject = rejectPromise)));
  const user = userEvent.setup();
  render(<AuthScreen onSignIn={onSignIn} onSignUp={vi.fn()} />);

  await user.type(screen.getByLabelText('邮箱'), 'me@example.com');
  await user.type(screen.getByLabelText('密码'), 'secret123');
  await user.click(screen.getByRole('button', { name: '登录' }));
  expect(screen.getByRole('button', { name: '正在登录...' })).toBeDisabled();

  reject(new Error('邮箱或密码不正确'));
  expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确');
  expect(screen.getByLabelText('邮箱')).toHaveValue('me@example.com');
});

it('registers with profile fields and keeps values when registration fails', async () => {
  const onSignUp = vi.fn().mockRejectedValue(new Error('密码至少需要 6 位'));
  const user = userEvent.setup();
  render(<AuthScreen onSignIn={vi.fn()} onSignUp={onSignUp} />);

  await user.click(screen.getByRole('tab', { name: '注册' }));
  expect(screen.getByLabelText('昵称')).toHaveAttribute('autocomplete', 'name');
  expect(screen.getByLabelText('密码')).toHaveAttribute('autocomplete', 'new-password');
  await user.type(screen.getByLabelText('昵称'), '小雨');
  await user.type(screen.getByLabelText('邮箱'), 'me@example.com');
  await user.type(screen.getByLabelText('密码'), '123');
  await user.click(screen.getByRole('button', { name: '创建账号' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('密码至少需要 6 位');
  expect(screen.getByLabelText('昵称')).toHaveValue('小雨');
  expect(screen.getByLabelText('邮箱')).toHaveValue('me@example.com');
});

it('shows the verification notice returned by registration', async () => {
  const user = userEvent.setup();
  render(
    <AuthScreen
      onSignIn={vi.fn()}
      onSignUp={vi.fn().mockResolvedValue('verification_required')}
    />,
  );
  await user.click(screen.getByRole('tab', { name: '注册' }));
  await user.type(screen.getByLabelText('昵称'), '小雨');
  await user.type(screen.getByLabelText('邮箱'), 'me@example.com');
  await user.type(screen.getByLabelText('密码'), 'secret123');
  await user.click(screen.getByRole('button', { name: '创建账号' }));

  expect(await screen.findByRole('status')).toHaveTextContent('请检查 me@example.com');
});

it('sends a password reset code from the forgot-password flow', async () => {
  const onRequestPasswordReset = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<AuthScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onRequestPasswordReset={onRequestPasswordReset} />);

  await user.click(screen.getByRole('button', { name: '忘记密码？' }));
  await user.type(screen.getByLabelText('邮箱'), 'me@example.com');
  await user.click(screen.getByRole('button', { name: '发送验证码' }));

  expect(onRequestPasswordReset).toHaveBeenCalledWith('me@example.com');
  expect(await screen.findByRole('status')).toHaveTextContent('验证码已发送');
});
