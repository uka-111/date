import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudSetupScreen } from './CloudSetupScreen';

it('lets a single member regenerate a one-time visible invite', async () => {
  const user = userEvent.setup();
  render(
    <CloudSetupScreen
      displayName="小雨"
      memberCount={1}
      onRegenerateInvite={vi.fn().mockResolvedValue({
        coupleId: 'couple-1', partnerId: 'her', inviteCode: 'NEWCODE12345', expiresAt: '2026-07-29T10:00:00.000Z',
      })}
      onSignOut={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();
});

it('shows completion and no regenerate action when both members have joined', () => {
  render(<CloudSetupScreen displayName="小雨" memberCount={2} onRegenerateInvite={vi.fn()} onSignOut={vi.fn()} />);

  expect(screen.getByText('双方已配对')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重新生成邀请码' })).not.toBeInTheDocument();
});
