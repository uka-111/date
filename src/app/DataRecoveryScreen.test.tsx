import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataRecoveryScreen } from './DataRecoveryScreen';

it('asks for confirmation before resetting application data', async () => {
  const onReset = vi.fn();
  const user = userEvent.setup();

  render(<DataRecoveryScreen onReset={onReset} />);

  expect(screen.getByRole('heading', { name: '本地数据无法读取' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '重置约会数据' }));
  expect(screen.getByRole('dialog', { name: '确认重置约会数据吗？' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '确认重置' }));
  expect(onReset).toHaveBeenCalledOnce();
});
