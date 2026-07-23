import { describe, expect, it } from 'vitest';
import { mapSnapshot } from './supabaseMappers';

const ids = new Map([
  ['user-him', 'him' as const],
  ['user-her', 'her' as const],
]);

describe('Supabase mappers', () => {
  it('maps an invitation and its ordered history to the domain model', () => {
    const snapshot = mapSnapshot({
      availabilities: [{ id: 'availability-1', couple_id: 'couple-1', owner_id: 'user-her', date: '2026-07-25', periods: ['evening'], note: '下班后', updated_at: '2026-07-20T10:00:00Z' }],
      invitations: [{ id: 'invite-1', couple_id: 'couple-1', sender_id: 'user-him', recipient_id: 'user-her', date: '2026-07-25', periods: ['evening'], activities: ['散步', '吃饭'], note: '慢慢来', status: 'pending', created_at: '2026-07-20T10:00:00Z', updated_at: '2026-07-20T10:00:00Z' }],
      events: [{ id: 'event-1', couple_id: 'couple-1', invitation_id: 'invite-1', actor_id: 'user-him', action: 'created', note: null, proposed_date: null, proposed_periods: null, proposed_activities: null, created_at: '2026-07-20T10:00:00Z' }],
      notifications: [{ id: 'notice-1', couple_id: 'couple-1', recipient_id: 'user-her', invitation_id: 'invite-1', kind: 'created', created_at: '2026-07-20T10:00:00Z', read_at: null }],
      dailyNotes: [{ id: 'note-1', couple_id: 'couple-1', date: '2026-07-25', title: '夏夜', body: '风很舒服', created_by: 'user-him', created_at: '2026-07-20T10:00:00Z', updated_at: '2026-07-20T10:00:00Z' }],
      preference: { user_id: 'user-him', calendar_scale: 'year', updated_at: '2026-07-20T10:00:00Z' },
    }, ids);

    expect(snapshot).toMatchObject({
      availability: [expect.objectContaining({ ownerId: 'her' })],
      invitations: [expect.objectContaining({ senderId: 'him', recipientId: 'her', activity: ['散步', '吃饭'], history: [expect.objectContaining({ actorId: 'him', action: 'created' })] })],
      notifications: [expect.objectContaining({ recipientId: 'her' })],
      dailyNotes: [expect.objectContaining({ title: '夏夜' })],
      viewPreference: 'year',
    });
  });

  it('rejects an unsupported cloud enum instead of guessing', () => {
    expect(() => mapSnapshot({
      availabilities: [], invitations: [], events: [], notifications: [], dailyNotes: [],
      preference: { user_id: 'user-him', calendar_scale: 'week', updated_at: '2026-07-20T10:00:00Z' },
    }, ids)).toThrow('云端数据格式不受支持');
  });
});
