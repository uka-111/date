import { render, screen } from '@testing-library/react';
import { App } from './App';

it('shows the private app entry screen', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: '我们的约会日历' }),
  ).toBeInTheDocument();
});
