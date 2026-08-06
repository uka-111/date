import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';

const common = {
  open: true,
  displayName: '小雨',
  email: 'a@example.com',
  partnerId: 'him' as const,
  onClose: vi.fn(),
  onUpdateDisplayName: vi.fn().mockResolvedValue('新名字'),
  onUpdateEmail: vi.fn().mockResolvedValue(undefined),
  onUpdatePassword: vi.fn().mockResolvedValue(undefined),
  onLeaveCouple: vi.fn().mockResolvedValue(undefined),
  onSignOut: vi.fn(),
};

it('keeps account profile collapsed until selected', async () => {
  const user = userEvent.setup();
  render(<SettingsPanel {...common} />);

  expect(screen.getByText('账号资料')).toBeInTheDocument();
  expect(screen.queryByText('用户名')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /账号资料/ }));
  expect(screen.getByText('用户名')).toBeInTheDocument();
  expect(screen.getByText('邮箱')).toBeInTheDocument();
  expect(screen.getByText('修改密码')).toBeInTheDocument();
  expect(screen.getByText('当前身份')).toBeInTheDocument();
  expect(screen.getByText('取消配对')).toBeInTheDocument();
  expect(screen.getByText('退出账号')).toBeInTheDocument();
});

it('updates the display name through the account editor', async () => {
  const user = userEvent.setup();
  render(<SettingsPanel {...common} />);

  await user.click(screen.getByRole('button', { name: /账号资料/ }));
  await user.click(screen.getByRole('button', { name: /用户名/ }));
  const input = screen.getByRole('textbox');
  await user.clear(input);
  await user.type(input, '新名字');
  await user.click(screen.getByRole('button', { name: '保存' }));

  expect(common.onUpdateDisplayName).toHaveBeenCalledWith('新名字');
  expect(await screen.findByRole('status')).toHaveTextContent('用户名已更新');
});

it('closes with Escape and keeps dangerous actions available', () => {
  render(<SettingsPanel {...common} />);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(common.onClose).toHaveBeenCalledOnce();
  expect(screen.getByText('设置')).toBeInTheDocument();
});
