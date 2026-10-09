'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Clock3, FileText } from 'lucide-react';
import type { Item, Track } from '@/lib/types';
import { readRecent, type RecentFile } from '@/lib/recent';
export default function RecentFiles({ slug, track, items, onOpen }: {
  slug: string; track: Track; items: Item[] | null; onOpen: (item: Item, index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  useEffect(() => {
    const update = () => setRecent(readRecent(slug, track));
    update();
    window.addEventListener('bme-recent-changed', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('bme-recent-changed', update); window.removeEventListener('storage', update); };
  }, [slug, track]);
  return <section className="mb-5 overflow-hidden rounded-xl border border-line bg-panel">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
      className="flex w-full items-center gap-2 px-4 py-3 text-start hover:bg-line/40">
      <Clock3 size={19} className="text-brand" />
      <span className="flex-1 font-semibold">آخر الملفات المفتوحة {track === 'theory' ? '· نظري' : track === 'lab' ? '· مختبر' : ''}</span>
      <span className="text-xs text-muted">{recent.length}</span>
      <ChevronDown size={18} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="space-y-1 border-t border-line px-3 py-2">
      {recent.length === 0 ? <p className="p-2 text-sm text-muted">ما فتحت ملفات بهذا القسم بعد.</p> : recent.map((r) => {
        const item = items?.find((x) => x.id === r.itemId);
        return <button key={`${r.itemId}-${r.index}`} type="button"
          onClick={() => item && onOpen(item, r.index)} disabled={!item}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-start hover:bg-line/50 disabled:opacity-60">
          <FileText size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.filename}</span>
            <span className="block truncate text-xs text-muted">{r.title}</span></span>
          {!item && <span className="text-xs text-muted">{items ? 'غير متاح' : 'بدون اتصال'}</span>}
        </button>;
      })}
      <p className="px-2 text-xs text-muted">تُحفظ أسماء الملفات فقط؛ فتح PDF يحتاج اتصالاً.</p>
    </div>}
  </section>;
}
