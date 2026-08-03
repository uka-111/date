import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createLocalRepository } from '../../storage/localRepository';
import { DayPanel } from './DayPanel';

it('switches to the partner memory as a read-only view', async () => {
  const repository = createLocalRepository(localStorage);
  repository.saveDailyNote({ ownerId: 'him', date: '2026-07-30', title: '我的记录', body: '我的内容', createdAt: '2026-07-30T00:00:00Z', updatedAt: '2026-07-30T00:00:00Z' });
  repository.saveDailyNote({ ownerId: 'her', date: '2026-07-30', title: '她的记录', body: '她的内容', createdAt: '2026-07-30T00:00:00Z', updatedAt: '2026-07-30T00:00:00Z' });
  const user = userEvent.setup();

  render(<DayPanel date="2026-07-30" partnerId="him" availability={[]} repository={repository} onSaved={vi.fn()} />);

  const ownerSwitch = screen.getByRole('button', { name: '我的' });
  expect(ownerSwitch).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: '对方' })).not.toBeInTheDocument();
  await user.click(ownerSwitch);
  expect(screen.getByRole('button', { name: '对方' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('记录标题')).toBeVisible();
  expect(screen.getByText('她的记录')).toBeVisible();
  expect(screen.getAllByText('当天记录')).toHaveLength(2);
  expect(screen.getByText('她的内容')).toBeVisible();
  expect(screen.queryByRole('button', { name: '保存记录' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '删除记录' })).not.toBeInTheDocument();
});
