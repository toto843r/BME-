'use client';
import { BrainCircuit, Eye, FileText, Flag, PlayCircle, Share2, Star } from 'lucide-react';
import Link from 'next/link';
import { itemFiles } from '@/lib/recent';
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
  async function share() {
    const url = `${window.location.origin}/f/${item.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: item.title, url }); } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert('تم نسخ الرابط');
    } catch {
      window.prompt('انسخ الرابط:', url);
    }
  }
  const badges = BADGES.filter((b) => item.badges.includes(b.key));
  const files = itemFiles(item);
  const nFiles = files.length;
  const pdfs = item.category === 'lectures' ? files.filter((f) => f.kind === 'pdf') : [];
  return (
    <div className="rounded-xl border border-line bg-panel p-3 transition-colors hover:border-brand/50">
      <div className="flex items-start gap-2">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-start">
        <span className="mt-0.5 text-brand">{item.file_kind === 'video' ? <PlayCircle size={22} /> : item.file_kind === 'text' ? <FileText size={22} /> : <Eye size={22} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{item.title}</span>
          {item.description && <span dir="auto" className="mt-1 line-clamp-3 block whitespace-pre-line text-start text-sm text-muted">{item.description}</span>}
          {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
          {(badges.length > 0 || item.tags.length > 0 || nFiles > 1) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {nFiles > 1 && <span className="rounded-md bg-brand/15 px-1.5 py-0.5 text-xs font-semibold text-brand">{nFiles} ملفات</span>}
              {badges.map((b) => <span key={b.key} className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>)}
              {item.tags.map((t) => <span key={t} className="rounded-md bg-line/70 px-1.5 py-0.5 text-xs text-muted">{t}</span>)}
            </span>
          )}
        </span>
      </button>
      <button onClick={onStar} aria-label={starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} aria-pressed={starred} className="p-1.5">
        <Star size={19} className={starred ? 'fill-now text-now' : 'text-muted'} />
      </button>
      <button onClick={share} aria-label="مشاركة الملف" className="p-1.5 text-muted hover:text-ink"><Share2 size={17} /></button>
      <button onClick={report} aria-label="الإبلاغ عن مشكلة" className="p-1.5 text-muted hover:text-ink"><Flag size={17} /></button>
      </div>
      {pdfs.length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        {pdfs.map((f) => <Link key={f.path} href={`/quiz/${item.id}?file=${encodeURIComponent(f.path)}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand hover:bg-brand/20">
          <BrainCircuit size={16} /> <span className="max-w-48 truncate">اختبر نفسك{pdfs.length > 1 ? ` · ${f.name || f.path.split('/').pop()}` : ''}</span>
        </Link>)}
      </div>}
    </div>
  );
}
