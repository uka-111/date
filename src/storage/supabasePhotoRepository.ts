import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { PartnerId } from '../domain/models';
import type { PhotoRepository, PhotoRecord } from './photoRepository';

function extension(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

const imageTypesByExtension: Record<string, string> = {
  gif: 'image/gif',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const imageTypeAliases: Record<string, string> = {
  'image/jfif': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

export const MAX_CLOUD_PHOTO_BYTES = 30 * 1024 * 1024;

export function normalizeImageType(type: string, fileName = '') {
  const normalizedType = imageTypeAliases[type.trim().toLowerCase()] ?? type.trim().toLowerCase();
  if (['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(normalizedType)) return normalizedType;
  const extensionFromName = fileName.toLowerCase().split('.').at(-1) ?? '';
  return imageTypesByExtension[extensionFromName] ?? normalizedType;
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
  async function list(date: string, ownerId?: PartnerId) {
    const map = await identityMap();
    const selectedUserId = ownerId
      ? [...map.entries()].find(([, identity]) => identity === ownerId)?.[0]
      : undefined;
    let photosQuery = client.from('daily_photos').select('*').eq('couple_id', coupleId).eq('date', date);
    if (selectedUserId) photosQuery = photosQuery.eq('uploaded_by', selectedUserId);
    const rowsResult = await photosQuery.order('created_at');
    if (rowsResult.error || !rowsResult.data) throw new Error('照片暂时无法读取');
    return Promise.all(rowsResult.data.map(async (row, order): Promise<PhotoRecord> => {
      const { data, error } = await client.storage.from('date-photos').createSignedUrl(row.storage_path, 3600);
      if (error || !data?.signedUrl) throw new Error('照片暂时无法读取');
      const placeholder = new Blob([], { type: row.mime_type });
      return { id: row.id, ownerId: map.get(row.uploaded_by), date: row.date, blob: placeholder, thumbnail: placeholder, url: data.signedUrl, thumbnailUrl: data.signedUrl, title: '', createdAt: row.created_at, order };
    }));
  }
  return {
    list,
    async add(input) {
      const mimeType = normalizeImageType(input.blob.type, input.fileName);
      if (!['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('暂只支持 JPG、PNG、WebP 或 GIF 图片');
      if (input.blob.size > MAX_CLOUD_PHOTO_BYTES) throw new Error('图片文件超过 30 MB，请压缩后再上传');
      const path = `${coupleId}/${input.date}/${crypto.randomUUID()}.${extension(mimeType)}`;
      const uploaded = await client.storage.from('date-photos').upload(path, input.blob, { contentType: mimeType, upsert: false });
      if (uploaded.error) throw new Error('照片上传失败');
      const saved = await client.rpc('create_daily_photo', { p_date: input.date, p_storage_path: path, p_mime_type: mimeType });
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
