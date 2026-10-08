'use client';
import { Eye, Flag, PlayCircle, Star } from 'lucide-react';
import type { Item } from '@/lib/types';
import { BADGES } from '@/lib/courses';
import { supabase } from '@/lib/supabase';

export default function ItemCard({ item, starred, onStar, onOpen, subtitle }:
  { item: Item; starred: boolean; onStar: () => void; onOpen: () => void; subtitle?: string }) {
  async function report() {
    const reason = window.prompt('ما المشكلة؟ (الملف لا يفتح / ناقص / خطأ في المحتوى)');
    if (reason === null) return;
    const { error } = await supabase.from('reports').insert({ item_id: item.id, reason: reason.slice(0, 300) });
    window.alert(error ? 'تعذر إرسال البلاغ، حاول لاحقاً.' : 'وصل البلاغ، شكراً.');
  }
  const badges = BADGES.filter((b) => item.badges.includes(b.key));
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-panel p-3">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-start">
        <span className="mt-0.5 text-brand">{item.file_kind === 'video' ? <PlayCircle size={22} /> : <Eye size={22} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{item.title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
          {(badges.length > 0 || item.tags.length > 0) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {badges.map((b) => <span key={b.key} className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>)}
              {item.tags.map((t) => <span key={t} className="rounded-md bg-line/70 px-1.5 py-0.5 text-xs text-muted">{t}</span>)}
            </span>
          )}
        </span>
      </button>
      <button onClick={onStar} aria-label={starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} aria-pressed={starred} className="p-1.5">
        <Star size={19} className={starred ? 'fill-now text-now' : 'text-muted'} />
      </button>
      <button onClick={report} aria-label="الإبلاغ عن مشكلة" className="p-1.5 text-muted hover:text-ink"><Flag size={17} /></button>
    </div>
  );
}
