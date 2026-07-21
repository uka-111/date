import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { CloudSetupScreen } from './CloudSetupScreen';

it('lets a single member regenerate a one-time visible invite', async () => {
  const user = userEvent.setup();
  render(
    <CloudSetupScreen
      userId="user-a"
      displayName="小雨"
      memberCount={1}
      onRegenerateInvite={vi.fn().mockResolvedValue({
        coupleId: 'couple-1', partnerId: 'her', inviteCode: 'NEWCODE12345', expiresAt: '2026-07-29T10:00:00.000Z',
      })}
      onRefresh={vi.fn()}
      onSignOut={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();
});

it('shows completion and no regenerate action when both members have joined', () => {
  render(<CloudSetupScreen userId="user-a" displayName="小雨" memberCount={2} onRegenerateInvite={vi.fn()} onRefresh={vi.fn()} onSignOut={vi.fn()} />);

  expect(screen.getByText('双方已配对')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重新生成邀请码' })).not.toBeInTheDocument();
});

it('refreshes membership when the page regains focus', async () => {
  const onRefresh = vi.fn();

  function Harness() {
    const [memberCount, setMemberCount] = useState(1);
    return (
      <CloudSetupScreen
        userId="user-a"
        displayName="小雨"
        memberCount={memberCount}
        onRegenerateInvite={vi.fn()}
        onRefresh={async () => {
          onRefresh();
          setMemberCount(2);
        }}
        onSignOut={vi.fn()}
      />
    );
  }

  render(<Harness />);
  expect(screen.getByText('等待对方加入')).toBeInTheDocument();

  fireEvent.focus(window);

  expect(await screen.findByText('双方已配对')).toBeInTheDocument();
  expect(onRefresh).toHaveBeenCalledOnce();
});

it('offers an explicit membership refresh action', async () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <CloudSetupScreen
      userId="user-a"
      displayName="小雨"
      memberCount={1}
      onRegenerateInvite={vi.fn()}
      onRefresh={onRefresh}
      onSignOut={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '刷新配对状态' }));

  expect(onRefresh).toHaveBeenCalledOnce();
});

it('shows pending and a stable error when sign out fails', async () => {
  let rejectSignOut!: (error: Error) => void;
  const onSignOut = vi.fn(() => new Promise<void>((_, reject) => {
    rejectSignOut = reject;
  }));
  const user = userEvent.setup();
  render(
    <CloudSetupScreen
      userId="user-a"
      displayName="小雨"
      memberCount={2}
      onRegenerateInvite={vi.fn()}
      onRefresh={vi.fn()}
      onSignOut={onSignOut}
    />,
  );

  await user.click(screen.getByRole('button', { name: '退出账号' }));
  expect(screen.getByRole('button', { name: '正在退出...' })).toBeDisabled();

  rejectSignOut(new Error('sensitive backend detail'));
  expect(await screen.findByRole('alert')).toHaveTextContent('退出失败，请稍后再试');
});

it('does not start a focus refresh while invite regeneration is pending', async () => {
  let resolveInvite!: (invite: { inviteCode: string; expiresAt: string }) => void;
  const onRegenerateInvite = vi.fn(() => new Promise<{ inviteCode: string; expiresAt: string }>((resolve) => {
    resolveInvite = resolve;
  }));
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <CloudSetupScreen
      userId="user-a"
      displayName="小雨"
      memberCount={1}
      onRegenerateInvite={onRegenerateInvite}
      onRefresh={onRefresh}
      onSignOut={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(screen.getByRole('button', { name: '正在生成...' })).toBeDisabled();

  fireEvent.focus(window);

  expect(onRefresh).not.toHaveBeenCalled();
  resolveInvite({ inviteCode: 'NEWCODE12345', expiresAt: '2026-07-29T10:00:00.000Z' });
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();
});

it('clears an in-memory invite when the couple fills or the user changes', async () => {
  const user = userEvent.setup();
  const common = {
    displayName: '小雨',
    onRegenerateInvite: vi.fn().mockResolvedValue({ inviteCode: 'NEWCODE12345', expiresAt: '2026-07-29T10:00:00.000Z' }),
    onRefresh: vi.fn(),
    onSignOut: vi.fn(),
  };
  const view = render(<CloudSetupScreen {...common} userId="user-a" memberCount={1} />);
  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();

  view.rerender(<CloudSetupScreen {...common} userId="user-a" memberCount={2} />);
  view.rerender(<CloudSetupScreen {...common} userId="user-a" memberCount={1} />);
  expect(screen.queryByText('NEWCODE12345')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();
  view.rerender(<CloudSetupScreen {...common} userId="user-b" memberCount={1} />);
  expect(screen.queryByText('NEWCODE12345')).not.toBeInTheDocument();
});
