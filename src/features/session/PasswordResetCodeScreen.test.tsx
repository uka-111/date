import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordResetCodeScreen } from './PasswordResetCodeScreen';

it('verifies a six-digit recovery code before completing', async () => {
  const onVerify = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<PasswordResetCodeScreen email="me@example.com" onVerify={onVerify} onResend={vi.fn()} onBack={vi.fn()} />);

  await user.type(screen.getByLabelText('验证码'), '123456');
  await user.click(screen.getByRole('button', { name: '验证验证码' }));

  expect(onVerify).toHaveBeenCalledWith('123456');
});

it('shows an error when the recovery code is rejected', async () => {
  const user = userEvent.setup();
  render(<PasswordResetCodeScreen email="me@example.com" onVerify={vi.fn().mockRejectedValue(new Error('验证码无效或已过期'))} onResend={vi.fn()} onBack={vi.fn()} />);

  await user.type(screen.getByLabelText('验证码'), '123456');
  await user.click(screen.getByRole('button', { name: '验证验证码' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('验证码无效或已过期');
});
