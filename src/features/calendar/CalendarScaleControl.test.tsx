import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarScaleControl } from './CalendarScaleControl';

it('switches from month to year', async () => {
  const onChange = vi.fn();
  render(<CalendarScaleControl scale="month" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '年' }));
  expect(onChange).toHaveBeenCalledWith('year');
});
