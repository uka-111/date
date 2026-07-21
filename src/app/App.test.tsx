import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeAuthGateway } from '../test/fakeAuthGateway';
import { App } from './App';

it('routes every session state without opening local calendar data', async () => {
  const cases = [
    { gateway: new FakeAuthGateway(), text: '留一页给我们' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: false } }), text: 'a@example.com' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: true }, accountContext: { displayName: '小雨', membership: null } }), text: '创建我们的空间' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: true }, accountContext: { displayName: '小雨', membership: { coupleId: 'c1', partnerId: 'him' as const, memberCount: 2 } } }), text: '双方已配对' },
  ];

  for (const value of cases) {
    const view = render(<App authGateway={value.gateway} />);
    expect(await screen.findByText(value.text)).toBeInTheDocument();
    expect(screen.queryByText('共享日历')).not.toBeInTheDocument();
    view.unmount();
  }
});

it('renders stable configuration errors instead of throwing', async () => {
  const gateway = new FakeAuthGateway();
  gateway.restoreError = new Error('Supabase 连接信息尚未配置');
  render(<App authGateway={gateway} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Supabase 连接信息尚未配置');
});

it('preserves a newly-created invite across duplicate auth events until continue', async () => {
  const session = { userId: 'u1', email: 'a@example.com', emailVerified: true };
  const gateway = new FakeAuthGateway({
    session,
    accountContext: { displayName: '小雨', membership: null },
  });
  const user = userEvent.setup();
  render(<App authGateway={gateway} />);
  await screen.findByRole('button', { name: '创建我们的空间' });
  expect(gateway.loadAccountContextCalls).toEqual(['u1']);

  await user.click(screen.getByRole('button', { name: '创建我们的空间' }));
  await user.click(screen.getByRole('button', { name: '我是她' }));
  await user.click(screen.getByRole('button', { name: '生成邀请码' }));
  expect(await screen.findByText('CODE12345678')).toBeInTheDocument();

  gateway.accountContext = {
    displayName: '小雨',
    membership: { coupleId: 'couple-1', partnerId: 'her', memberCount: 1 },
  };
  act(() => gateway.emit({ ...session }));

  expect(screen.getByText('CODE12345678')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '进入我们的空间' })).toBeInTheDocument();
  expect(screen.queryByText('等待对方加入')).not.toBeInTheDocument();
  expect(gateway.loadAccountContextCalls).toEqual(['u1']);

  await user.click(screen.getByRole('button', { name: '进入我们的空间' }));
  expect(await screen.findByText('等待对方加入')).toBeInTheDocument();
  expect(gateway.loadAccountContextCalls).toEqual(['u1', 'u1']);
});
