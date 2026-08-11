import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { PhotoRecord, PhotoRepository } from '../../storage/photoRepository';
import { PhotoGallery } from './PhotoGallery';

vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob(['jpeg photo'], { type: 'image/jpeg' })),
}));

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

it('shows only the selected member photos for the same day', async () => {
  const records: PhotoRecord[] = [
    { id: 'photo-him', ownerId: 'him', date: '2026-07-30', blob: new Blob(['him'], { type: 'image/jpeg' }), thumbnail: new Blob(['him'], { type: 'image/jpeg' }), title: '', createdAt: '2026-07-30T12:00:00.000Z', order: 0 },
    { id: 'photo-her', ownerId: 'her', date: '2026-07-30', blob: new Blob(['her'], { type: 'image/jpeg' }), thumbnail: new Blob(['her'], { type: 'image/jpeg' }), title: '', createdAt: '2026-07-30T12:01:00.000Z', order: 1 },
  ];

  render(<PhotoGallery date="2026-07-30" repository={createRepository(records)} ownerId="him" />);

  expect(await screen.findAllByRole('img')).toHaveLength(1);
});

it('clears the previous member photos while loading the next member photos', async () => {
  const himPhoto: PhotoRecord = {
    id: 'photo-him',
    ownerId: 'him',
    date: '2026-07-30',
    blob: new Blob(['him'], { type: 'image/jpeg' }),
    thumbnail: new Blob(['him'], { type: 'image/jpeg' }),
    title: '',
    createdAt: '2026-07-30T12:00:00.000Z',
    order: 0,
  };
  const herPhoto: PhotoRecord = {
    ...himPhoto,
    id: 'photo-her',
    ownerId: 'her',
    blob: new Blob(['her'], { type: 'image/jpeg' }),
    thumbnail: new Blob(['her'], { type: 'image/jpeg' }),
  };
  let resolveHim!: (photos: PhotoRecord[]) => void;
  let resolveHer!: (photos: PhotoRecord[]) => void;
  const repository = createRepository([]);
  vi.mocked(repository.list)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveHim = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveHer = resolve; }));

  const { rerender } = render(<PhotoGallery date="2026-07-30" repository={repository} ownerId="him" />);
  resolveHim([himPhoto]);
  expect(await screen.findAllByRole('img')).toHaveLength(1);

  rerender(<PhotoGallery date="2026-07-30" repository={repository} ownerId="her" />);
  await waitFor(() => expect(repository.list).toHaveBeenCalledTimes(2));
  expect(screen.queryAllByRole('img')).toHaveLength(0);

  resolveHer([herPhoto]);
  expect(await screen.findAllByRole('img')).toHaveLength(1);
});

it('converts a mobile HEIC photo to JPEG before uploading', async () => {
  const repository = createRepository([]);
  render(<PhotoGallery date="2026-07-30" repository={repository} />);

  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  const heicPhoto = new File(['mobile photo'], 'IMG_1234.HEIC', { type: 'image/heic' });
  fireEvent.change(input!, { target: { files: [heicPhoto] } });

  await waitFor(() => expect(repository.add).toHaveBeenCalled());
  expect(repository.add).toHaveBeenCalledWith(expect.objectContaining({
    blob: expect.objectContaining({ type: 'image/jpeg' }),
    fileName: 'IMG_1234.jpg',
  }));
});

it('zooms the active photo with the mouse wheel and clamps the zoom range', async () => {
  const photo: PhotoRecord = {
    id: 'photo-zoom',
    date: '2026-07-30',
    blob: new Blob(['photo'], { type: 'image/jpeg' }),
    thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
    title: '',
    createdAt: '2026-07-30T12:00:00.000Z',
    order: 0,
  };
  const user = userEvent.setup();
  render(<PhotoGallery date="2026-07-30" repository={createRepository([photo])} />);

  await user.click((await screen.findAllByRole('img'))[0]);
  const activeImage = screen.getByRole('dialog').querySelector('img');
  expect(activeImage).not.toBeNull();
  const zoomEvent = createEvent.wheel(activeImage!, { deltaY: -100, cancelable: true });
  fireEvent(activeImage!, zoomEvent);
  expect(zoomEvent.defaultPrevented).toBe(true);
  expect(activeImage).toHaveStyle({ transform: 'scale(1.2)' });

  for (let index = 0; index < 20; index += 1) fireEvent.wheel(activeImage!, { deltaY: -100 });
  expect(activeImage).toHaveStyle({ transform: 'scale(3)' });
  for (let index = 0; index < 30; index += 1) fireEvent.wheel(activeImage!, { deltaY: 100 });
  expect(activeImage).toHaveStyle({ transform: 'scale(1)' });
});
