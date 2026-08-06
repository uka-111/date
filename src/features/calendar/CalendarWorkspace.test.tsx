import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarWorkspace } from './CalendarWorkspace';
import { createLocalRepository } from '../../storage/localRepository';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('jumps to a selected month and closes the panel', async () => {
  const user = userEvent.setup();
  const repository = createLocalRepository(localStorage);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const nextYear = new Date().getFullYear() + 1;
  render(<CalendarWorkspace repository={repository} partnerId="him" />);

  await user.click(screen.getByRole('button', { name: `${currentYear}年${currentMonth}月` }));
  await user.selectOptions(screen.getByLabelText('年份'), String(nextYear));
  await user.selectOptions(screen.getByLabelText('月份'), '2');

  expect(screen.getByRole('button', { name: `${nextYear}年2月` })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByLabelText('快速定位')).not.toBeInTheDocument();
});

it('jumps to a selected year while staying in year view', async () => {
  const user = userEvent.setup();
  const repository = createLocalRepository(localStorage);
  const currentYear = new Date().getFullYear();
  const nextYear = new Date().getFullYear() + 1;
  render(<CalendarWorkspace repository={repository} partnerId="him" />);

  await user.click(screen.getByRole('button', { name: '年' }));
  await user.click(screen.getByRole('button', { name: `${currentYear}年` }));
  await user.selectOptions(screen.getByLabelText('年份'), String(nextYear));

  expect(screen.getByRole('button', { name: `${nextYear}年` })).toHaveAttribute('aria-expanded', 'false');
});

it('jumps to a selected five-year range while staying in five-year view', async () => {
  const user = userEvent.setup();
  const repository = createLocalRepository(localStorage);
  const currentYear = new Date().getFullYear();
  const nextStartYear = new Date().getFullYear() + 1;
  render(<CalendarWorkspace repository={repository} partnerId="him" />);

  await user.click(screen.getByRole('button', { name: '5年' }));
  await user.click(screen.getByRole('button', { name: `${currentYear}-${currentYear + 4}` }));
  await user.selectOptions(screen.getByLabelText('五年区间起始年份'), String(nextStartYear));

  expect(screen.getByRole('button', { name: `${nextStartYear}-${nextStartYear + 4}` })).toHaveAttribute('aria-expanded', 'false');
});
