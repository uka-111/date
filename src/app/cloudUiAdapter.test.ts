import { expect, it, vi } from 'vitest';
import { emptyBookingSnapshot } from './bookingSnapshot';
import { createCloudUiAdapter } from './cloudUiAdapter';
import { createFakeBookingRepository } from '../test/fakeBookingRepository';

it('reads only the current member note when both partners wrote on the same day', () => {
  const repository = createCloudUiAdapter(
    {
      ...emptyBookingSnapshot(),
      dailyNotes: [
        { ownerId: 'her', date: '2026-07-30', title: '她的记录', body: '她的内容', createdAt: '2026-07-30T00:00:00Z', updatedAt: '2026-07-30T00:00:00Z' },
        { ownerId: 'him', date: '2026-07-30', title: '我的记录', body: '我的内容', createdAt: '2026-07-30T00:00:00Z', updatedAt: '2026-07-30T00:00:00Z' },
      ],
    },
    createFakeBookingRepository(),
    vi.fn(),
    vi.fn(),
    'him',
  );

  expect(repository.getDailyNote('2026-07-30')).toMatchObject({ ownerId: 'him', title: '我的记录' });
});
