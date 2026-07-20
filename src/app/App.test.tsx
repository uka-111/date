import { render, screen } from '@testing-library/react';
import { App } from './App';

it('shows the private app entry screen', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: '留一页给我们' }),
  ).toBeInTheDocument();
});
