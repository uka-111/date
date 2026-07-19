import { createPhotoRepository } from './photoRepository';

it('stores six photos for one date and rejects the seventh', async () => {
  const repository = createPhotoRepository('photo-test');
  const date = `2026-07-${String(Math.floor(Math.random() * 9) + 10)}`;
  for (let index = 0; index < 6; index += 1) {
    await repository.add({ date, blob: new Blob(['x'], { type: 'image/jpeg' }), title: `photo ${index}` });
  }
  expect(await repository.count(date)).toBe(6);
  await expect(repository.add({ date, blob: new Blob(['x'], { type: 'image/jpeg' }), title: '' }))
    .rejects.toThrow('每天最多保存 6 张照片');
});
