import { createPhotoRepository } from './photoRepository';

it('stores thirty photos for one date and rejects the thirty-first', async () => {
  const repository = createPhotoRepository('photo-test');
  const date = `2026-07-${String(Math.floor(Math.random() * 9) + 10)}`;
  for (let index = 0; index < 30; index += 1) {
    await repository.add({ date, blob: new Blob(['x'], { type: 'image/jpeg' }), title: `photo ${index}` });
  }
  expect(await repository.count(date)).toBe(30);
  await expect(repository.add({ date, blob: new Blob(['x'], { type: 'image/jpeg' }), title: '' }))
    .rejects.toThrow('每天最多保存 30 张照片');
});
