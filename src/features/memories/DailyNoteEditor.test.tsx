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
