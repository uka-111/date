import { render, screen } from '@testing-library/react';
import { FakeAuthGateway } from '../test/fakeAuthGateway';
import { App } from './App';

it('shows a loading state before session restoration finishes', () => {
  const gateway = new FakeAuthGateway();
  gateway.restoreSession = () => new Promise(() => undefined);

  render(<App authGateway={gateway} />);

  expect(screen.getByText('正在恢复登录...')).toBeInTheDocument();
});
