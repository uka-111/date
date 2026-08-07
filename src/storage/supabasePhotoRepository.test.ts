import { expect, it, vi } from 'vitest';
import { createSupabasePhotoRepository, normalizeImageType } from './supabasePhotoRepository';

it('normalizes mobile image MIME types before cloud upload validation', () => {
  expect(normalizeImageType('image/jpg')).toBe('image/jpeg');
  expect(normalizeImageType('image/jpeg')).toBe('image/jpeg');
  expect(normalizeImageType('image/png')).toBe('image/png');
  expect(normalizeImageType('image/gif')).toBe('image/gif');
  expect(normalizeImageType('', 'mobile-photo.JPG')).toBe('image/jpeg');
  expect(normalizeImageType('', 'animation.gif')).toBe('image/gif');
});

it('filters cloud photos by the selected member before downloading image blobs', async () => {
  const memberQuery = {
    select: vi.fn(() => memberQuery),
    eq: vi.fn(async () => ({ data: [{ user_id: 'her-user', identity: 'her' }], error: null })),
  };
  const photoEq = vi.fn((column: string, value: string) => {
    photoFilters.push([column, value]);
    return photoQuery;
  });
  const photoFilters: Array<[string, string]> = [];
  const photoQuery = {
    select: vi.fn(() => photoQuery),
    eq: photoEq,
    order: vi.fn(async () => ({ data: [], error: null })),
  };
  const client = {
    from: vi.fn((table: string) => table === 'couple_members' ? memberQuery : photoQuery),
    storage: { from: vi.fn() },
  } as never;
  const repository = createSupabasePhotoRepository(client, 'couple-1', 'him-user');

  await repository.list('2026-08-07', 'her');

  expect(photoFilters).toContainEqual(['uploaded_by', 'her-user']);
});

it('returns signed URLs without waiting for full image downloads', async () => {
  const memberQuery = {
    select: vi.fn(() => memberQuery),
    eq: vi.fn(async () => ({ data: [{ user_id: 'her-user', identity: 'her' }], error: null })),
  };
  const photoQuery = {
    select: vi.fn(() => photoQuery),
    eq: vi.fn(() => photoQuery),
    order: vi.fn(async () => ({
      data: [{
        id: 'photo-her',
        couple_id: 'couple-1',
        date: '2026-08-07',
        mime_type: 'image/jpeg',
        storage_path: 'couple-1/2026-08-07/photo.jpg',
        uploaded_by: 'her-user',
        created_at: '2026-08-07T12:00:00.000Z',
      }],
      error: null,
    })),
  };
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://storage.example/photo.jpg' }, error: null }));
  const client = {
    from: vi.fn((table: string) => table === 'couple_members' ? memberQuery : photoQuery),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as never;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, blob: async () => new Blob(['photo']) } as Response);
  const repository = createSupabasePhotoRepository(client, 'couple-1', 'him-user');

  const [photo] = await repository.list('2026-08-07', 'her');

  expect(photo.url).toBe('https://storage.example/photo.jpg');
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
