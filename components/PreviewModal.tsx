'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BrainCircuit, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { Item } from '@/lib/types';
import { downloadUrl, fileUrl } from '@/lib/supabase';
import { youtubeEmbed } from '@/lib/media';
import { itemFiles, recordRecent } from '@/lib/recent';

const ResponsiveImageViewer = dynamic(() => import('./ResponsiveImageViewer'), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-muted">جارٍ تحميل عارض الصور…</p>,
});

const ResponsivePdfViewer = dynamic(() => import('./ResponsivePdfViewer'), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-muted">جارٍ تحميل قارئ PDF…</p>,
});

// Use the same PDF reader across lectures, quizzes, midterms, finals, reports,
// summaries and labs. Older uploaded records may have an incorrect kind.
function isImageFile(file: { kind?: string; path: string; name?: string } | undefined): boolean {
  if (!file || isPdfFile(file)) return false;
  return file.kind?.toLowerCase() === 'image' ||
    /\.(?:png|jpe?g|webp|gif|bmp|avif)(?:$|[?#])/i.test(file.path) ||
    /\.(?:png|jpe?g|webp|gif|bmp|avif)(?:$|[?#])/i.test(file.name || '');
}

function isPdfFile(file: { kind?: string; path: string; name?: string } | undefined): boolean {
  if (!file) return false;
  return file.kind?.toLowerCase() === 'pdf' ||
    /\.pdf(?:$|[?#])/i.test(file.path) ||
    /\.pdf(?:$|[?#])/i.test(file.name || '');
}

export default function PreviewModal({ item, onClose, initialIndex = 0 }: {
  item: Item | null; onClose: () => void; initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const files = item ? itemFiles(item) : [];
  useEffect(() => { setIndex(initialIndex); }, [item?.id, initialIndex]);
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
  const isPdf = isPdfFile(file);
  const isImage = isImageFile(file);
  return <div className="fixed inset-0 z-50 bg-black/65 md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={item.title}>
    <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden bg-panel md:h-full md:rounded-2xl">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-2.5 sm:gap-2 sm:p-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold">{item.title}</h2>
        {isPdf && file && item.category === 'lectures' && <Link href={`/quiz/${item.id}?file=${encodeURIComponent(file.path)}`} className="flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-2 text-xs font-semibold text-brand"><BrainCircuit size={15} /> اختبر نفسك</Link>}
        {dl && <a href={dl} className="flex items-center gap-1 rounded-lg bg-brand px-2 py-2 text-xs font-semibold text-onbrand"><Download size={15} /> تحميل</a>}
        <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-2 hover:bg-line/60"><X size={18} /></button>
      </div>
      {files.length > 1 && <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-bg p-2">
        {files.map((f, i) => <button key={`${f.path}-${i}`} onClick={() => setIndex(i)} aria-pressed={i === index}
          className={`max-w-52 shrink-0 truncate rounded-lg border px-3 py-2 text-xs font-semibold ${i === index ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel text-muted'}`} title={f.name || `ملف ${i+1}`}>
          {f.name || `ملف ${i + 1}`} · {i + 1}/{files.length}
        </button>)}
      </div>}
      <div className={`min-h-0 flex-1 ${isPdf ? 'overflow-hidden' : 'overflow-auto overscroll-contain'}`}>
        {embed && <div className="aspect-video w-full bg-black"><iframe src={embed} title={item.title} allowFullScreen className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture" /></div>}
        {!embed && item.external_url && <div className="flex flex-col items-center gap-3 p-6"><p className="text-muted">هذا رابط خارجي لا يمكن تضمينه.</p><a href={item.external_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 text-onbrand">فتح الرابط</a></div>}
        {isImage && file && <ResponsiveImageViewer key={url} url={url} title={file.name || item.title} />}
        {isPdf && file && <ResponsivePdfViewer key={url} url={url} title={file.name || item.title} />}
        {!isPdf && !isImage && file?.kind === 'doc' && <iframe key={url} src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`} title={item.title} loading="lazy" className="block h-[72dvh] w-full" />}
        {item.description && <div className="space-y-2 border-t border-line p-4 text-base leading-relaxed">{item.description.split('\n').map((line, i) => line.trim() ? <p key={i} dir="auto" className="text-start">{line}</p> : <div key={i} className="h-2" />)}</div>}
      </div>
      {files.length > 1 && <div className="flex items-center justify-between border-t border-line p-2">
        <button disabled={index === 0} onClick={() => { setIndex(index - 1); }} className="flex items-center gap-1 rounded-lg p-2 text-sm disabled:opacity-30"><ChevronRight size={18} /> السابق</button>
        <span className="text-xs text-muted">{index + 1} / {files.length}</span>
        <button disabled={index === files.length - 1} onClick={() => { setIndex(index + 1); }} className="flex items-center gap-1 rounded-lg p-2 text-sm disabled:opacity-30">التالي <ChevronLeft size={18} /></button>
      </div>}
    </div>
  </div>;
}
