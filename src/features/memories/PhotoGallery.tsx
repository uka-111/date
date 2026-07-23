import { useEffect, useState } from 'react';
import type { PhotoRepository, PhotoRecord } from '../../storage/photoRepository';
import { MAX_LOCAL_PHOTOS_PER_DAY } from '../../storage/photoRepository';

export function PhotoGallery({ date, repository, onChanged }: { date: string; repository: PhotoRepository; onChanged?: () => void }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState<PhotoRecord | null>(null);
  const load = () => repository.list(date).then(setPhotos).catch(() => setError('照片暂时无法读取'));
  useEffect(() => { void load(); }, [date]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    for (const file of Array.from(event.target.files ?? [])) {
      try {
        if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
        await repository.add({ date, blob: file, title: file.name.replace(/\.[^.]+$/, '') });
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
    <div className="photo-grid">{photos.map((photo) => <figure key={photo.id}><button className="photo-open" type="button" onClick={() => setActive(photo)}><img src={URL.createObjectURL(photo.thumbnail)} alt={photo.title || '当天照片'} /></button><figcaption>{photo.title}</figcaption><button type="button" aria-label={`删除${photo.title || '照片'}`} onClick={() => remove(photo)}>删除</button></figure>)}</div>
    <label className="upload-button" title="选择当天的照片">
      <span aria-hidden="true">+</span>
      添加照片
      <input type="file" accept="image/*" multiple onChange={upload} />
    </label>
    {error && <p role="alert">{error}</p>}
    {active && <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="照片查看器"><button type="button" aria-label="关闭照片" onClick={() => setActive(null)}>关闭</button><img src={URL.createObjectURL(active.blob)} alt={active.title || '当天照片'} /><p>{active.title}</p></div>}
  </section>;
}
