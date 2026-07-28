import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarQuickJump } from './CalendarQuickJump';

it('shows year and month selectors for month view and reports the selected month', async () => {
  const onChange = vi.fn();
  render(<CalendarQuickJump scale="month" anchor={new Date(2026, 6, 1)} open onChange={onChange} />);

  await userEvent.selectOptions(screen.getByLabelText('年份'), '2027');
  await userEvent.selectOptions(screen.getByLabelText('月份'), '2');

  expect(onChange).toHaveBeenLastCalledWith(new Date(2027, 1, 1));
});

it('shows only a year selector for year view', () => {
  render(<CalendarQuickJump scale="year" anchor={new Date(2026, 6, 1)} open onChange={vi.fn()} />);

  expect(screen.getByLabelText('年份')).toBeInTheDocument();
  expect(screen.queryByLabelText('月份')).not.toBeInTheDocument();
});

it('shows five-year start year for five-year view', async () => {
  const onChange = vi.fn();
  render(<CalendarQuickJump scale="five_years" anchor={new Date(2026, 6, 1)} open onChange={onChange} />);

  await userEvent.selectOptions(screen.getByLabelText('五年区间起始年份'), '2030');

  expect(onChange).toHaveBeenCalledWith(new Date(2030, 0, 1));
});
