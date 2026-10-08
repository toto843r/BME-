'use client';
import { useEffect } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import type { Item } from '@/lib/types';
import { downloadUrl, fileUrl } from '@/lib/supabase';
import { youtubeEmbed } from '@/lib/media';

export default function PreviewModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [item, onClose]);
  if (!item) return null;

  const url = item.file_path ? fileUrl(item.file_path) : item.external_url || '';
  const embed = item.external_url ? youtubeEmbed(item.external_url) : null;
  const ext = item.file_path?.split('.').pop() || '';

  let body: React.ReactNode;
  if (embed) {
    body = <iframe src={embed} title={item.title} allowFullScreen className="h-full w-full"
      allow="accelerometer; encrypted-media; picture-in-picture" />;
  } else if (item.file_kind === 'image' && item.file_path) {
    body = <div className="flex h-full items-center justify-center overflow-auto bg-black/5 p-2"><img src={url} alt={item.title} className="max-h-full max-w-full object-contain" /></div>;
  } else if (item.file_kind === 'pdf' && item.file_path) {
    body = <iframe src={url} title={item.title} className="h-full w-full" />;
  } else if (item.file_kind === 'doc' && item.file_path) {
    body = <iframe src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`} title={item.title} className="h-full w-full" />;
  } else {
    body = <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted">هذا رابط خارجي لا يمكن تضمينه.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand">فتح الرابط</a>
    </div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 md:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden bg-panel md:h-full md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <h2 className="flex-1 truncate font-semibold">{item.title}</h2>
          {item.file_path && (
            <a href={downloadUrl(item.file_path, `${item.title}.${ext}`)} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-onbrand">
              <Download size={15} /> تحميل
            </a>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="فتح في تبويب جديد" className="rounded-lg p-2 hover:bg-line/60"><ExternalLink size={17} /></a>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-2 hover:bg-line/60"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1">{body}</div>
      </div>
    </div>
  );
}
