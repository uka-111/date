import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PairingScreen } from './PairingScreen';

it('offers create and join without identity controls until create is selected', async () => {
  const user = userEvent.setup();
  render(<PairingScreen displayName="小雨" onCreate={vi.fn()} onRedeem={vi.fn()} onContinue={vi.fn()} onSignOut={vi.fn()} />);

  expect(screen.getByRole('button', { name: '创建我们的空间' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '加入对方的空间' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '我是他' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '创建我们的空间' }));
  const identityButtons = [
    screen.getByRole('button', { name: '我是他' }),
    screen.getByRole('button', { name: '我是她' }),
  ];
  expect(identityButtons[0]).toHaveClass('identity-option');
  expect(identityButtons[1]).toHaveClass('identity-option');
});

it('shows a newly-created invite in memory and waits for explicit continue', async () => {
  const onContinue = vi.fn();
  const user = userEvent.setup();
  render(
    <PairingScreen
      displayName="小雨"
      onCreate={vi.fn().mockResolvedValue({
        coupleId: 'couple-1', partnerId: 'her', inviteCode: 'ABC123XYZ789', expiresAt: '2026-07-29T10:00:00.000Z',
      })}
      onRedeem={vi.fn()}
      onContinue={onContinue}
      onSignOut={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: '创建我们的空间' }));
  await user.click(screen.getByRole('button', { name: '我是她' }));
  await user.click(screen.getByRole('button', { name: '生成邀请码' }));

  expect(await screen.findByText('ABC123XYZ789')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '复制邀请码' })).toBeEnabled();
  expect(screen.getByText(/7 天有效，使用后失效/)).toBeInTheDocument();
  expect(screen.getByText(/2026/)).toBeInTheDocument();
  expect(onContinue).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '进入我们的空间' }));
  expect(onContinue).toHaveBeenCalledOnce();
});

it('keeps a failed join code and normalizes successful submissions', async () => {
  const onRedeem = vi.fn().mockRejectedValueOnce(new Error('邀请码不可用')).mockResolvedValueOnce({ coupleId: 'couple-1', partnerId: 'him' });
  const onContinue = vi.fn();
  const user = userEvent.setup();
  render(<PairingScreen displayName="小雨" onCreate={vi.fn()} onRedeem={onRedeem} onContinue={onContinue} onSignOut={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: '加入对方的空间' }));
  await user.type(screen.getByLabelText('邀请码'), ' abcd-1234 ');
  await user.click(screen.getByRole('button', { name: '加入空间' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('邀请码不可用');
  expect(screen.getByLabelText('邀请码')).toHaveValue(' abcd-1234 ');
  await user.click(screen.getByRole('button', { name: '加入空间' }));

  expect(onRedeem).toHaveBeenLastCalledWith('ABCD-1234');
  expect(onContinue).toHaveBeenCalledOnce();
});

it('shows pending and a stable error when sign out fails', async () => {
  let rejectSignOut!: (error: Error) => void;
  const onSignOut = vi.fn(() => new Promise<void>((_, reject) => {
    rejectSignOut = reject;
  }));
  const user = userEvent.setup();
  render(<PairingScreen displayName="小雨" onCreate={vi.fn()} onRedeem={vi.fn()} onContinue={vi.fn()} onSignOut={onSignOut} />);

  await user.click(screen.getByRole('button', { name: '退出账号' }));
  expect(screen.getByRole('button', { name: '正在退出...' })).toBeDisabled();

  rejectSignOut(new Error('sensitive backend detail'));
  expect(await screen.findByRole('alert')).toHaveTextContent('退出失败，请稍后再试');
});
