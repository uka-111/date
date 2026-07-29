import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { PhotoRecord, PhotoRepository } from '../../storage/photoRepository';
import { PhotoGallery } from './PhotoGallery';

function createRepository(records: PhotoRecord[]): PhotoRepository {
  return {
    list: vi.fn(async () => records),
    add: vi.fn(),
    updateTitle: vi.fn(),
    delete: vi.fn(async (id: string) => {
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
    }),
    count: vi.fn(async () => records.length),
  };
}

it('uses a compact accessible delete control without showing a photo name', async () => {
  const photo: PhotoRecord = {
    id: 'photo-1',
    date: '2026-07-30',
    blob: new Blob(['photo'], { type: 'image/jpeg' }),
    thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
    title: '晚霞',
    createdAt: '2026-07-30T12:00:00.000Z',
    order: 0,
  };
  const repository = createRepository([photo]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const user = userEvent.setup();

  render(<PhotoGallery date="2026-07-30" repository={repository} />);

  expect(await screen.findByRole('button', { name: '删除当天照片' })).toHaveClass('photo-delete');
  expect(screen.queryByText('晚霞')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '删除当天照片' }));
  expect(confirm).toHaveBeenCalledWith('确定删除这张照片吗？');
  expect(repository.delete).not.toHaveBeenCalled();
});
