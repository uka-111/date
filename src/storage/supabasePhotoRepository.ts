import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { PhotoRepository, PhotoRecord } from './photoRepository';

function extension(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export function createSupabasePhotoRepository(client: SupabaseClient<Database>, coupleId: string, userId: string): PhotoRepository {
  let identities: Map<string, 'him' | 'her'> | null = null;
  async function identityMap() {
    if (identities) return identities;
    const { data, error } = await client.from('couple_members').select('user_id, identity').eq('couple_id', coupleId);
    if (error || !data) throw new Error('照片暂时无法读取');
    identities = new Map(data.map((row) => [row.user_id, row.identity]));
    return identities;
  }
  async function list(date: string) {
    const [rowsResult, map] = await Promise.all([
      client.from('daily_photos').select('*').eq('couple_id', coupleId).eq('date', date).order('created_at'),
      identityMap(),
    ]);
    if (rowsResult.error || !rowsResult.data) throw new Error('照片暂时无法读取');
    return Promise.all(rowsResult.data.map(async (row, order): Promise<PhotoRecord> => {
      const { data, error } = await client.storage.from('date-photos').createSignedUrl(row.storage_path, 3600);
      if (error || !data?.signedUrl) throw new Error('照片暂时无法读取');
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('照片暂时无法读取');
      const blob = await response.blob();
      return { id: row.id, ownerId: map.get(row.uploaded_by), date: row.date, blob, thumbnail: blob, title: '', createdAt: row.created_at, order };
    }));
  }
  return {
    list,
    async add(input) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.blob.type) || input.blob.size > 10485760) throw new Error('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片');
      const path = `${coupleId}/${input.date}/${crypto.randomUUID()}.${extension(input.blob.type)}`;
      const uploaded = await client.storage.from('date-photos').upload(path, input.blob, { contentType: input.blob.type, upsert: false });
      if (uploaded.error) throw new Error('照片上传失败');
      const saved = await client.rpc('create_daily_photo', { p_date: input.date, p_storage_path: path, p_mime_type: input.blob.type });
      if (saved.error) { await client.storage.from('date-photos').remove([path]); throw new Error('照片上传失败'); }
      const created = (await list(input.date)).at(-1);
      if (!created) throw new Error('照片上传失败');
      return created;
    },
    async updateTitle() { return undefined; },
    async delete(id) {
      const removed = await client.rpc('delete_daily_photo', { p_photo_id: id });
      if (removed.error || !removed.data) throw new Error('照片删除失败，请重试');
      const storage = await client.storage.from('date-photos').remove([removed.data]);
      if (storage.error) throw new Error('照片删除失败，请重试');
    },
    async count(date) {
      const ownIdentity = (await identityMap()).get(userId);
      return (await list(date)).filter((item) => item.ownerId === ownIdentity).length;
    },
  };
}
