export interface PhotoRecord {
  id: string;
  date: string;
  blob: Blob;
  thumbnail: Blob;
  title: string;
  createdAt: string;
  order: number;
}

export interface PhotoInput {
  date: string;
  blob: Blob;
  title: string;
}

export interface PhotoRepository {
  list(date: string): Promise<PhotoRecord[]>;
  add(input: PhotoInput): Promise<PhotoRecord>;
  updateTitle(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
  count(date: string): Promise<number>;
}

export const MAX_LOCAL_PHOTOS_PER_DAY = 30;
const memory = new Map<string, PhotoRecord>();

export function createPhotoRepository(
  _name = 'couple-date-booking-media',
  limit = MAX_LOCAL_PHOTOS_PER_DAY,
): PhotoRepository {
  const useIndexedDb = typeof indexedDB !== 'undefined';
  const request = <T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
      if (!useIndexedDb) return reject(new Error('indexedDB unavailable'));
      const open = indexedDB.open(_name, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        const store = db.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('date', 'date');
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(storeName, mode);
        const req = action(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
    });

  async function list(date: string) {
    if (!useIndexedDb) return [...memory.values()].filter((item) => item.date === date).sort((a, b) => a.order - b.order);
    const all = await request<PhotoRecord[]>('photos', 'readonly', (store) => store.index('date').getAll(date));
    return all.sort((a, b) => a.order - b.order);
  }

  async function add(input: PhotoInput) {
    if (await count(input.date) >= limit) throw new Error(`每天最多保存 ${limit} 张照片`);
    const now = new Date().toISOString();
    const existing = await list(input.date);
    const record: PhotoRecord = { id: crypto.randomUUID(), date: input.date, blob: input.blob, thumbnail: input.blob, title: input.title.trim(), createdAt: now, order: existing.length };
    if (!useIndexedDb) memory.set(record.id, record);
    else await request('photos', 'readwrite', (store) => store.put(record));
    return record;
  }

  async function updateTitle(id: string, title: string) {
    const item = useIndexedDb ? await request<PhotoRecord>('photos', 'readonly', (store) => store.get(id)) : memory.get(id);
    if (!item) return;
    const updated = { ...item, title: title.trim() };
    if (!useIndexedDb) memory.set(id, updated);
    else await request('photos', 'readwrite', (store) => store.put(updated));
  }

  async function remove(id: string) {
    if (!useIndexedDb) memory.delete(id);
    else await request('photos', 'readwrite', (store) => store.delete(id));
  }

  async function count(date: string) { return (await list(date)).length; }
  return { list, add, updateTitle, delete: remove, count };
}
