import { useEffect, useState } from 'react';
import type { PhotoRepository, PhotoRecord } from '../../storage/photoRepository';
import { MAX_LOCAL_PHOTOS_PER_DAY } from '../../storage/photoRepository';

export function PhotoGallery({ date, repository, ownerId, readOnly = false, onChanged }: { date: string; repository: PhotoRepository; ownerId?: 'him' | 'her'; readOnly?: boolean; onChanged?: () => void }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState<PhotoRecord | null>(null);
  const load = () => repository.list(date).then((items) => setPhotos(ownerId ? items.filter((item) => !item.ownerId || item.ownerId === ownerId) : items)).catch(() => setError('照片暂时无法读取'));
  useEffect(() => { void load(); }, [date, ownerId]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    for (const file of Array.from(event.target.files ?? [])) {
      try {
        if (!file.type.startsWith('image/') && !/\.(gif|jpe?g|png|webp)$/i.test(file.name)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片');
        await repository.add({ date, blob: file, fileName: file.name, title: file.name.replace(/\.[^.]+$/, '') });
      }
      catch (caught) { setError(caught instanceof Error ? caught.message : '照片上传失败'); }
    }
    await load();
    onChanged?.();
    event.target.value = '';
  }
  async function remove(photo: PhotoRecord) {
    if (!window.confirm('确定删除这张照片吗？')) return;
    await repository.delete(photo.id); setActive(null); await load(); onChanged?.();
  }
  return <section className="photo-gallery" aria-label="当天照片">
    <div className="memory-header"><h4>当天照片</h4><span>{photos.length}/{MAX_LOCAL_PHOTOS_PER_DAY}</span></div>
    <div className="photo-grid">{photos.map((photo) => <figure key={photo.id}>
      <button className="photo-open" type="button" onClick={() => setActive(photo)}><img src={URL.createObjectURL(photo.thumbnail)} alt={photo.title || '当天照片'} /></button>
      {!readOnly && <button className="photo-delete" type="button" aria-label="删除当天照片" onClick={() => remove(photo)}>×</button>}
    </figure>)}</div>
    {!readOnly && <label className="upload-button" title="选择当天的照片">
      <span aria-hidden="true">+</span>
      添加照片
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={upload} />
    </label>}
    {error && <p role="alert">{error}</p>}
    {active && <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="照片查看器"><button type="button" aria-label="关闭照片" onClick={() => setActive(null)}>关闭</button><img src={URL.createObjectURL(active.blob)} alt={active.title || '当天照片'} /><p>{active.title}</p></div>}
  </section>;
}
