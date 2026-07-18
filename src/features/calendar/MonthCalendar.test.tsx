import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { MonthCalendar } from './MonthCalendar';

beforeEach(() => {
  localStorage.clear();
});

it('shows both partners availability on the selected day', async () => {
  const repository = createLocalRepository(localStorage);
  repository.saveAvailability({
    id: 'her:2026-07-25',
    ownerId: 'her',
    date: '2026-07-25',
    periods: ['evening'],
    note: '',
    updatedAt: '2026-07-18T10:00:00.000Z',
  });
  repository.saveAvailability({
    id: 'him:2026-07-25',
    ownerId: 'him',
    date: '2026-07-25',
    periods: ['afternoon'],
    note: '',
    updatedAt: '2026-07-18T10:00:00.000Z',
  });

  render(
    <MonthCalendar
      initialMonth="2026-07"
      repository={repository}
      partnerId="him"
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '7月25日' }));

  expect(screen.getByText('她：晚上')).toBeInTheDocument();
  expect(screen.getByText('他：下午')).toBeInTheDocument();
});

it('saves the current partner availability from the day panel', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(
    <MonthCalendar
      initialMonth="2026-07"
      repository={repository}
      partnerId="him"
    />,
  );

  await user.click(screen.getByRole('button', { name: '7月25日' }));
  await user.click(screen.getByLabelText('晚上'));
  await user.click(screen.getByRole('button', { name: '保存我的空闲时间' }));

  expect(repository.read().availability[0]).toMatchObject({
    id: 'him:2026-07-25',
    periods: ['evening'],
  });
  expect(screen.getByText('他：晚上')).toBeInTheDocument();
});
