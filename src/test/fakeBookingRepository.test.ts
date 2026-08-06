import { describe, expect, it } from 'vitest';
import { createFakeBookingRepository } from './fakeBookingRepository';

describe('fake booking repository', () => {
  it('loads an empty asynchronous snapshot', async () => {
    const repository = createFakeBookingRepository();

    await expect(repository.load()).resolves.toEqual({
      availability: [],
      invitations: [],
      notifications: [],
      dailyNotes: [],
      viewPreference: 'month',
    });
  });

  it('notifies subscribers after a successful mutation', async () => {
    const repository = createFakeBookingRepository();
    const onChange = vi.fn();
    const unsubscribe = repository.subscribe(onChange);

    await repository.saveAvailability({
      date: '2026-07-25',
      periods: ['evening'],
      note: '一起散步',
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    await expect(repository.load()).resolves.toMatchObject({
      availability: [expect.objectContaining({ date: '2026-07-25' })],
    });
    unsubscribe();
  });

  it('does not mutate state when the next operation fails', async () => {
    const repository = createFakeBookingRepository();
    repository.failNext('网络暂时不可用');

    await expect(repository.saveViewPreference('year')).rejects.toThrow('网络暂时不可用');
    await expect(repository.load()).resolves.toMatchObject({ viewPreference: 'month' });
  });
});
