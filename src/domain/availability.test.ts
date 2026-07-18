import { createAvailability } from './availability';

it('normalizes duplicate periods and preserves a partner-specific record', () => {
  const value = createAvailability(
    {
      ownerId: 'her',
      date: '2026-07-25',
      periods: ['evening', 'evening'],
      note: '  下班后  ',
    },
    '2026-07-18T10:00:00.000Z',
  );

  expect(value.periods).toEqual(['evening']);
  expect(value.ownerId).toBe('her');
  expect(value.id).toBe('her:2026-07-25');
  expect(value.note).toBe('下班后');
});

it('rejects an availability record without a period', () => {
  expect(() =>
    createAvailability({
      ownerId: 'him',
      date: '2026-07-25',
      periods: [],
      note: '',
    }),
  ).toThrow('请至少选择一个空闲时段');
});
