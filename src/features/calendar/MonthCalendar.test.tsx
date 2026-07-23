import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { MonthCalendar } from './MonthCalendar';
import { invitationBuilder } from '../../test/builders';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('updates the date marker when a refreshed repository contains a confirmed invitation', () => {
  const pendingRepository = createLocalRepository(localStorage);
  const confirmedRepository = createLocalRepository(sessionStorage);
  pendingRepository.saveInvitation(invitationBuilder({ status: 'pending' }));
  confirmedRepository.saveInvitation(invitationBuilder({ status: 'confirmed' }));

  const view = render(<MonthCalendar initialMonth="2026-07" repository={pendingRepository} partnerId="him" />);
  expect(screen.getByRole('button', { name: '7月25日' })).toHaveAttribute('data-primary-state', 'none');

  view.rerender(<MonthCalendar initialMonth="2026-07" repository={confirmedRepository} partnerId="him" />);

  expect(screen.getByRole('button', { name: '7月25日' })).toHaveAttribute('data-primary-state', 'confirmed');
});

it('shows confirmed fill and both availability markers on the same date', () => {
  const repository = createLocalRepository(localStorage);
  repository.saveInvitation(invitationBuilder({ status: 'confirmed' }));
  repository.saveAvailability({ id: 'him:date', ownerId: 'him', date: '2026-07-25', periods: ['evening'], note: '', updatedAt: '' });
  repository.saveAvailability({ id: 'her:date', ownerId: 'her', date: '2026-07-25', periods: ['evening'], note: '', updatedAt: '' });

  render(<MonthCalendar initialMonth="2026-07" repository={repository} partnerId="him" />);
  const day = screen.getByRole('button', { name: '7月25日' });
  expect(day).toHaveAttribute('data-primary-state', 'confirmed');
  expect(day).toHaveAttribute('data-secondary-states', expect.stringContaining('him_available'));
  expect(day).toHaveAttribute('data-secondary-states', expect.stringContaining('her_available'));
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
