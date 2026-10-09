'use client';
import { useEffect } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import type { Item } from '@/lib/types';
import { downloadUrl, fileUrl } from '@/lib/supabase';
import { youtubeEmbed } from '@/lib/media';

interface F { path: string; kind: string; name?: string }

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

  const files: F[] = [
    ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind as string }] : []),
    ...(item.attachments || []),
  ];
  const url = item.file_path ? fileUrl(item.file_path) : item.external_url || '';
  const embed = item.external_url ? youtubeEmbed(item.external_url) : null;
  const dl = (f: F, i: number) =>
    downloadUrl(f.path, f.name && f.name.includes('.') ? f.name : `${item.title}${files.length > 1 ? `-${i + 1}` : ''}.${f.path.split('.').pop()}`);

  const mediaFor = (f: F) => {
    const u = fileUrl(f.path);
    if (f.kind === 'image') return <img src={u} alt={item.title} className="block h-auto w-full" />;
    if (f.kind === 'pdf') return <iframe src={u} title={item.title} className="block h-[75dvh] w-full" />;
    if (f.kind === 'doc') return <iframe src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(u)}`} title={item.title} className="block h-[75dvh] w-full" />;
    return null;
  };

  const lines = (item.description || '').split('\n');
  const hasMedia = !!embed || files.length > 0 || !!item.external_url;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 md:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden bg-panel md:h-full md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <h2 className="flex-1 truncate font-semibold">{item.title}</h2>
          {files.length === 1 && (
            <a href={dl(files[0], 0)} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-onbrand">
              <Download size={15} /> تحميل
            </a>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label="فتح في تبويب جديد" className="rounded-lg p-2 hover:bg-line/60"><ExternalLink size={17} /></a>
          )}
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-2 hover:bg-line/60"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {embed && (
            <div className="aspect-video w-full bg-black"><iframe src={embed} title={item.title} allowFullScreen className="h-full w-full"
              allow="accelerometer; encrypted-media; picture-in-picture" /></div>
          )}
          {!embed && item.external_url && (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-muted">هذا رابط خارجي لا يمكن تضمينه.</p>
              <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand">فتح الرابط</a>
            </div>
          )}
          {files.map((f, i) => (
            <div key={f.path}>
              {files.length > 1 && (
                <div className="flex items-center justify-between border-b border-line bg-bg px-3 py-1.5 text-xs text-muted">
                  <span>ملف {i + 1} من {files.length}</span>
                  <a href={dl(f, i)} className="flex items-center gap-1 font-semibold text-brand"><Download size={13} /> تحميل</a>
                </div>
              )}
              {mediaFor(f)}
            </div>
          ))}
          {item.description && (
            <div className={`space-y-1.5 p-4 text-base leading-relaxed ${hasMedia ? 'border-t border-line' : ''}`}>
              {lines.map((line, i) =>
                line.trim() ? <p key={i} dir="auto" className="text-start">{line}</p> : <div key={i} className="h-2" />,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
