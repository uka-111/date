import { useEffect, useRef, useState } from 'react';
import type { PhotoRepository, PhotoRecord } from '../../storage/photoRepository';
import { MAX_LOCAL_PHOTOS_PER_DAY } from '../../storage/photoRepository';

function isHeic(file: File) {
  return ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(file.type.toLowerCase())
    || /\.(heic|heif)$/i.test(file.name);
}

async function preparePhotoUpload(file: File) {
  if (!isHeic(file)) return { blob: file, fileName: file.name };
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new Error('这张 HEIC 照片无法转换，请换一张照片后重试');
  return { blob, fileName: `${file.name.replace(/\.(heic|heif)$/i, '') || 'photo'}.jpg` };
}

export function PhotoGallery({ date, repository, ownerId, readOnly = false, onChanged }: { date: string; repository: PhotoRepository; ownerId?: 'him' | 'her'; readOnly?: boolean; onChanged?: () => void }) {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.2;
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState<PhotoRecord | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const viewerStageRef = useRef<HTMLDivElement>(null);
  const loadVersion = useRef(0);
  async function load() {
    const version = ++loadVersion.current;
    try {
      const items = await repository.list(date, ownerId);
      if (version !== loadVersion.current) return;
      setPhotos(ownerId ? items.filter((item) => !item.ownerId || item.ownerId === ownerId) : items);
    } catch {
      if (version === loadVersion.current) setError('照片暂时无法读取');
    }
  }
  useEffect(() => {
    setPhotos([]);
    setError('');
    void load();
    return () => { loadVersion.current += 1; };
  }, [date, ownerId, repository]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setUploading(true);
    for (const file of Array.from(event.target.files ?? [])) {
      try {
        if (!file.type.startsWith('image/') && !/\.(gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)) throw new Error('请选择 JPG、PNG、WebP、GIF 或 HEIC 照片');
        const prepared = await preparePhotoUpload(file);
        await repository.add({ date, blob: prepared.blob, fileName: prepared.fileName, title: file.name.replace(/\.[^.]+$/, '') });
      }
      catch (caught) { setError(caught instanceof Error ? caught.message : '照片上传失败'); }
    }
    await load();
    onChanged?.();
    event.target.value = '';
    setUploading(false);
  }
  async function remove(photo: PhotoRecord) {
    if (!window.confirm('确定删除这张照片吗？')) return;
    await repository.delete(photo.id); setActive(null); await load(); onChanged?.();
  }
  function openPhoto(photo: PhotoRecord) {
    setActive(photo);
    setZoom(MIN_ZOOM);
  }
  useEffect(() => {
    const stage = viewerStageRef.current;
    if (!active || !stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)) * 10) / 10)));
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [active]);
  const photoCountClass = photos.length >= 3 ? 'photo-gallery-scroll' : `photo-gallery-count-${photos.length}`;
  return <section className={`photo-gallery ${photoCountClass}`} aria-label="当天照片">
    <div className="memory-header"><h4>当天照片</h4><span>{photos.length}/{MAX_LOCAL_PHOTOS_PER_DAY}</span></div>
    <div className={photos.length >= 3 ? 'photo-scroll' : undefined}>
    <div className="photo-grid" data-count={photos.length}>{photos.map((photo) => <figure key={photo.id}>
      <button className="photo-open" type="button" onClick={() => openPhoto(photo)}><img src={photo.thumbnailUrl ?? URL.createObjectURL(photo.thumbnail)} alt={photo.title || '当天照片'} /></button>
      {!readOnly && <button className="photo-delete" type="button" aria-label="删除当天照片" onClick={() => remove(photo)}>×</button>}
    </figure>)}</div>
    </div>
    {!readOnly && <label className="upload-button" title="选择当天的照片">
      <span aria-hidden="true">+</span>
      {uploading ? '正在添加...' : '添加照片'}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" multiple disabled={uploading} onChange={upload} />
    </label>}
    {uploading && <p role="status">正在添加照片...</p>}
    {error && <p role="alert">{error}</p>}
    {active && <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="照片查看器"><button type="button" aria-label="关闭照片" onClick={() => { setActive(null); setZoom(MIN_ZOOM); }}>关闭</button><div ref={viewerStageRef} className="photo-viewer-stage"><img style={{ transform: `scale(${zoom})` }} src={active.url ?? URL.createObjectURL(active.blob)} alt={active.title || '当天照片'} /></div><p>{active.title}</p></div>}
  </section>;
}
