import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeAuthGateway } from '../test/fakeAuthGateway';
import { createFakeBookingRepository } from '../test/fakeBookingRepository';
import { App } from './App';

const fakeBookingRepositoryFactory = () => createFakeBookingRepository();

it('routes every session state without opening local calendar data', async () => {
  const cases = [
    { gateway: new FakeAuthGateway(), text: '留一页给我们' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: false } }), text: 'a@example.com' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: true }, accountContext: { displayName: '小雨', membership: null } }), text: '创建我们的空间' },
    { gateway: new FakeAuthGateway({ session: { userId: 'u1', email: 'a@example.com', emailVerified: true }, accountContext: { displayName: '小雨', membership: { coupleId: 'c1', partnerId: 'him' as const, memberCount: 2 } } }), text: '共享月历' },
  ];

  for (const value of cases) {
    const view = render(<App authGateway={value.gateway} bookingRepositoryFactory={fakeBookingRepositoryFactory} />);
    expect(await screen.findByText(value.text)).toBeInTheDocument();
    view.unmount();
  }
});

it('renders stable configuration errors instead of throwing', async () => {
  const gateway = new FakeAuthGateway();
  gateway.restoreError = new Error('Supabase 连接信息尚未配置');
  render(<App authGateway={gateway} bookingRepositoryFactory={fakeBookingRepositoryFactory} />);

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

it('keeps the paired screen and invite mounted during a background membership refresh', async () => {
  const session = { userId: 'u1', email: 'a@example.com', emailVerified: true };
  const gateway = new FakeAuthGateway({
    session,
    accountContext: {
      displayName: '小雨',
      membership: { coupleId: 'couple-1', partnerId: 'her', memberCount: 1 },
    },
  });
  const user = userEvent.setup();
  render(<App authGateway={gateway} bookingRepositoryFactory={fakeBookingRepositoryFactory} />);
  await screen.findByText('等待对方加入');
  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();

  let resolveContext!: (context: typeof gateway.accountContext) => void;
  gateway.loadContext = () => new Promise((resolve) => {
    resolveContext = resolve;
  });
  fireEvent.focus(window);

  expect(screen.getByText('等待对方加入')).toBeInTheDocument();
  expect(screen.getByText('NEWCODE12345')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重新生成邀请码' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '退出账号' })).toBeDisabled();
  await waitFor(() => expect(resolveContext).toBeTypeOf('function'));

  await act(async () => resolveContext({
    displayName: '小雨',
    membership: { coupleId: 'couple-1', partnerId: 'her', memberCount: 2 },
  }));
  expect(await screen.findByRole('grid', { name: '共享月历' })).toBeInTheDocument();
});

it('keeps the previous paired state and shows a local error when background refresh fails', async () => {
  const gateway = new FakeAuthGateway({
    session: { userId: 'u1', email: 'a@example.com', emailVerified: true },
    accountContext: {
      displayName: '小雨',
      membership: { coupleId: 'couple-1', partnerId: 'her', memberCount: 1 },
    },
  });
  render(<App authGateway={gateway} />);
  await screen.findByText('等待对方加入');
  gateway.loadContext = () => Promise.reject(new Error('sensitive backend detail'));

  fireEvent.focus(window);

  expect(await screen.findByRole('alert')).toHaveTextContent('刷新配对状态失败，请稍后再试');
  expect(screen.getByText('等待对方加入')).toBeInTheDocument();
  expect(screen.queryByText('sensitive backend detail')).not.toBeInTheDocument();
});

it('clears the old invite and loads a new user when focus restore changes identity before auth event', async () => {
  const oldSession = { userId: 'old-user', email: 'old@example.com', emailVerified: true };
  const newSession = { userId: 'new-user', email: 'new@example.com', emailVerified: true };
  const gateway = new FakeAuthGateway({
    session: oldSession,
    accountContext: {
      displayName: '旧用户',
      membership: { coupleId: 'old-couple', partnerId: 'her', memberCount: 1 },
    },
  });
  const user = userEvent.setup();
  render(<App authGateway={gateway} />);
  await screen.findByText('等待对方加入');
  await user.click(screen.getByRole('button', { name: '重新生成邀请码' }));
  expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();

  const contextResolvers: Array<(context: typeof gateway.accountContext) => void> = [];
  gateway.loadContext = () => new Promise((resolve) => contextResolvers.push(resolve));
  gateway.setSession(newSession);
  fireEvent.focus(window);

  expect(await screen.findByText('正在恢复登录...')).toBeInTheDocument();
  expect(screen.queryByText('NEWCODE12345')).not.toBeInTheDocument();

  act(() => gateway.emit(newSession));
  await waitFor(() => expect(contextResolvers).toHaveLength(2));
  await act(async () => contextResolvers[1]({ displayName: '新用户', membership: null }));

  expect(await screen.findByText('你好，新用户')).toBeInTheDocument();
  expect(screen.queryByText('NEWCODE12345')).not.toBeInTheDocument();
});
