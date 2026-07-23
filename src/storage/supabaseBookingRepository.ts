import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateBookingRepository } from '../app/bookingRepository';
import type { Database } from '../lib/database.types';
import type { PartnerId } from '../domain/models';
import { mapSnapshot, type SupabaseSnapshotRows } from './supabaseMappers';

function throwForError(error: { message: string } | null) {
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes('network') || text.includes('fetch')) throw new Error('网络连接失败，请稍后再试');
    throw new Error('操作失败，请稍后再试');
  }
}

function dataOrThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  throwForError(result.error);
  if (result.data === null) throw new Error('操作失败，请稍后再试');
  return result.data;
}

function dataOrNull<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  throwForError(result.error);
  return result.data;
}

export function createSupabaseBookingRepository(
  client: SupabaseClient<Database>,
  coupleId: string,
  userId: string,
): DateBookingRepository {
  let identities: Map<string, PartnerId> | null = null;

  async function loadIdentities() {
    const memberships = dataOrThrow(await client
      .from('couple_members')
      .select('user_id, identity')
      .eq('couple_id', coupleId));
    if (memberships.length !== 2) throw new Error('双人空间成员信息不完整');
    identities = new Map(memberships.map((row) => [row.user_id, row.identity]));
    return identities;
  }

  async function load() {
    const identityMap = identities ?? await loadIdentities();
    const [availabilities, invitations, events, notifications, dailyNotes, preference] = await Promise.all([
      client.from('availabilities').select('*').eq('couple_id', coupleId),
      client.from('invitations').select('*').eq('couple_id', coupleId),
      client.from('invitation_events').select('*').eq('couple_id', coupleId).order('created_at'),
      client.from('notifications').select('*').eq('couple_id', coupleId),
      client.from('daily_notes').select('*').eq('couple_id', coupleId),
      client.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    const rows: SupabaseSnapshotRows = {
      availabilities: dataOrThrow(availabilities),
      invitations: dataOrThrow(invitations),
      events: dataOrThrow(events),
      notifications: dataOrThrow(notifications),
      dailyNotes: dataOrThrow(dailyNotes),
      preference: dataOrNull(preference),
    };
    return mapSnapshot(rows, identityMap);
  }

  async function rpc(name: keyof Database['public']['Functions'], args: Record<string, unknown>) {
    const result = await client.rpc(name, args as never);
    throwForError(result.error);
    return result.data;
  }

  return {
    load,
    async saveAvailability(input) {
      await rpc('save_availability', { p_date: input.date, p_periods: input.periods, p_note: input.note });
    },
    async createInvitation(input) {
      const id = await rpc('create_invitation', { p_date: input.date, p_periods: input.periods, p_activities: input.activities, p_note: input.note });
      if (typeof id !== 'string') throw new Error('操作失败，请稍后再试');
      return id;
    },
    async respondToInvitation(id, response) {
      await rpc('respond_to_invitation', {
        p_invitation_id: id,
        p_action: response.type,
        p_note: 'note' in response ? response.note ?? null : null,
        p_date: response.type === 'suggest-adjustment' ? response.date : null,
        p_periods: response.type === 'suggest-adjustment' ? response.periods : null,
        p_activities: response.type === 'suggest-adjustment' ? response.activity : null,
      });
    },
    async markNotificationRead(id) {
      await rpc('mark_notification_read', { p_notification_id: id });
    },
    async saveDailyNote(input) {
      await rpc('save_daily_note', { p_date: input.date, p_title: input.title, p_body: input.body });
    },
    async deleteDailyNote(date) {
      await rpc('delete_daily_note', { p_date: date });
    },
    async saveViewPreference(scale) {
      await rpc('save_user_preference', { p_calendar_scale: scale });
    },
    subscribe(onChange) {
      let pending = false;
      const invalidate = () => {
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          onChange();
        });
      };
      const channel = client.channel(`booking:${coupleId}:${userId}`);
      ['availabilities', 'invitations', 'invitation_events', 'notifications', 'daily_notes'].forEach((table) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` }, invalidate);
      });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` }, invalidate);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') invalidate();
      });
      return () => { void client.removeChannel(channel); };
    },
  };
}
