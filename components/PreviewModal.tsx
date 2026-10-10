'use client';
import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BookOpen, BrainCircuit, ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { Item } from '@/lib/types';
import { downloadUrl, fileUrl } from '@/lib/supabase';
import { youtubeEmbed } from '@/lib/media';
import { itemFiles, recordRecent } from '@/lib/recent';

const ResponsivePdfViewer = dynamic(() => import('./ResponsivePdfViewer'), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-muted">جارٍ تحميل عارض الملزمات…</p>,
});

/**
 * Open the device's native share/app chooser where the browser supports it.
 * Share the URL, not a downloaded Blob: PDF bytes are never fetched a second
 * time or buffered in memory just for this action.
 * If native sharing is unavailable, the anchor opens the PDF normally.
 */
function openPdfWithDeviceApp(event: MouseEvent<HTMLAnchorElement>, url: string, title: string) {
  if (typeof navigator.share !== 'function') return;
  const shareData = { title, url };
  if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) return;

  // Keep the share() call synchronous with the tap (required on iOS/Android).
  event.preventDefault();
  void navigator.share(shareData).catch((error: unknown) => {
    // Closing the system share sheet should not open or download anything.
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
    // Browser refused the share: show its native PDF preview instead.
    window.location.assign(url);
  });
}

export default function PreviewModal({ item, onClose, initialIndex = 0 }: {
  item: Item | null; onClose: () => void; initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const files = item ? itemFiles(item) : [];
  useEffect(() => { setIndex(initialIndex); setZoom(1); }, [item?.id, initialIndex]);
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((n) => Math.max(0, n - 1));
      if (event.key === 'ArrowLeft') setIndex((n) => Math.min(files.length - 1, n + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [item, onClose, files.length]);
  useEffect(() => { if (item && files[index]) recordRecent(item, index); }, [item, index]);
  if (!item) return null;
  const file = files[index];
  const url = file ? fileUrl(file.path) : item.external_url || '';
  const embed = item.external_url ? youtubeEmbed(item.external_url) : null;
  const dl = file && downloadUrl(file.path, file.name && file.name.includes('.') ? file.name : `${item.title}-${index + 1}.${file.path.split('.').pop()}`);
  const isImage = file?.kind === 'image';
  return <div className="fixed inset-0 z-50 bg-black/65 md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={item.title}>
    <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden bg-panel md:h-full md:rounded-2xl">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-2.5 sm:gap-2 sm:p-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold">{item.title}</h2>
        {file?.kind === 'pdf' && item.category === 'lectures' && <Link href={`/quiz/${item.id}?file=${encodeURIComponent(file.path)}`} className="flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-2 text-xs font-semibold text-brand"><BrainCircuit size={15} /> اختبر نفسك</Link>}
        {file?.kind === 'pdf' && url && <a
          href={url} target="_blank" rel="noopener noreferrer"
          onClick={(event) => openPdfWithDeviceApp(event, url, file.name || item.title)}
          title="اختر تطبيقاً من قائمة الجهاز، أو افتح PDF بالمتصفح إذا لم تتوفر المشاركة"
          className="flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2 py-2 text-xs font-semibold text-brand hover:bg-brand/20"
        ><BookOpen size={15} /> فتح بتطبيق PDF</a>}
        {dl && <a href={dl} className="flex items-center gap-1 rounded-lg bg-brand px-2 py-2 text-xs font-semibold text-onbrand"><Download size={15} /> تحميل</a>}
        <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-2 hover:bg-line/60"><X size={18} /></button>
      </div>
      {files.length > 1 && <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-bg p-2">
        {files.map((f, i) => <button key={`${f.path}-${i}`} onClick={() => { setIndex(i); setZoom(1); }} aria-pressed={i === index}
          className={`max-w-52 shrink-0 truncate rounded-lg border px-3 py-2 text-xs font-semibold ${i === index ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel text-muted'}`} title={f.name || `ملف ${i+1}`}>
          {f.name || `ملف ${i + 1}`} · {i + 1}/{files.length}
        </button>)}
      </div>}
      {isImage && <div className="flex items-center justify-center gap-2 border-b border-line p-2" role="group" aria-label="تكبير الصورة">
        <button aria-label="تصغير" onClick={() => setZoom((n) => Math.max(1, +(n - .25).toFixed(2)))} className="rounded-lg border border-line p-2"><Minus size={16} /></button>
        <span className="min-w-14 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <button aria-label="تكبير" onClick={() => setZoom((n) => Math.min(4, +(n + .25).toFixed(2)))} className="rounded-lg border border-line p-2"><Plus size={16} /></button>
        <button aria-label="إعادة الحجم" onClick={() => setZoom(1)} className="rounded-lg border border-line p-2"><RotateCcw size={16} /></button>
      </div>}
      <div className={`min-h-0 flex-1 ${file?.kind === 'pdf' ? 'overflow-hidden' : 'overflow-auto overscroll-contain'}`}>
        {embed && <div className="aspect-video w-full bg-black"><iframe src={embed} title={item.title} allowFullScreen className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture" /></div>}
        {!embed && item.external_url && <div className="flex flex-col items-center gap-3 p-6"><p className="text-muted">هذا رابط خارجي لا يمكن تضمينه.</p><a href={item.external_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 text-onbrand">فتح الرابط</a></div>}
        {file?.kind === 'image' && <div className="flex min-h-64 items-start justify-center overflow-auto bg-bg/40 p-3" style={{ minWidth: '100%' }}>
          <img src={url} alt={file.name || item.title} loading="lazy" className="h-auto max-w-none object-contain" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none' }} />
        </div>}
        {file?.kind === 'pdf' && <ResponsivePdfViewer key={url} url={url} title={file.name || item.title} />}
        {file?.kind === 'doc' && <iframe key={url} src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`} title={item.title} loading="lazy" className="block h-[72dvh] w-full" />}
        {item.description && <div className="space-y-2 border-t border-line p-4 text-base leading-relaxed">{item.description.split('\n').map((line, i) => line.trim() ? <p key={i} dir="auto" className="text-start">{line}</p> : <div key={i} className="h-2" />)}</div>}
      </div>
      {files.length > 1 && <div className="flex items-center justify-between border-t border-line p-2">
        <button disabled={index === 0} onClick={() => { setIndex(index - 1); setZoom(1); }} className="flex items-center gap-1 rounded-lg p-2 text-sm disabled:opacity-30"><ChevronRight size={18} /> السابق</button>
        <span className="text-xs text-muted">{index + 1} / {files.length}</span>
        <button disabled={index === files.length - 1} onClick={() => { setIndex(index + 1); setZoom(1); }} className="flex items-center gap-1 rounded-lg p-2 text-sm disabled:opacity-30">التالي <ChevronLeft size={18} /></button>
      </div>}
    </div>
  </div>;
}
