import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { DailyNoteEditor } from './DailyNoteEditor';

beforeEach(() => localStorage.clear());

it('saves one editable note per date and loads it again', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  const { unmount } = render(<DailyNoteEditor date="2026-07-25" repository={repository} />);
  await user.type(screen.getByLabelText('记录标题'), '第一次看日落');
  await user.type(screen.getByLabelText('当天记录'), '风很舒服。');
  await user.click(screen.getByRole('button', { name: '保存记录' }));
  unmount();
  render(<DailyNoteEditor date="2026-07-25" repository={repository} />);
  expect(screen.getByDisplayValue('第一次看日落')).toBeInTheDocument();
  expect(screen.getByDisplayValue('风很舒服。')).toBeInTheDocument();
});

it('groups note actions into a compact action row', () => {
  const repository = createLocalRepository(localStorage);
  repository.saveDailyNote({
    date: '2026-07-25',
    title: '第一次看日落',
    body: '风很舒服。',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  });

  render(<DailyNoteEditor date="2026-07-25" repository={repository} />);

  const actionRow = document.querySelector('.daily-note-actions');
  const saveButton = screen.getByRole('button', { name: '保存记录' });
  const deleteButton = screen.getByRole('button', { name: '删除记录' });
  expect(actionRow).toContainElement(saveButton);
  expect(actionRow).toContainElement(deleteButton);
  expect(saveButton).toHaveClass('daily-note-save');
  expect(deleteButton).toHaveClass('daily-note-delete');
});
