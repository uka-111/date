import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordResetScreen } from './PasswordResetScreen';

it('requires matching passwords before updating', async () => {
  const onUpdatePassword = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<PasswordResetScreen onUpdatePassword={onUpdatePassword} onComplete={vi.fn()} />);

  await user.type(screen.getByLabelText('新密码'), 'secret123');
  await user.type(screen.getByLabelText('确认新密码'), 'different123');
  await user.click(screen.getByRole('button', { name: '保存新密码' }));

  expect(onUpdatePassword).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveTextContent('两次输入的密码不一致');
});
