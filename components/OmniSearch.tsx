'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/types';
import { CATEGORY_AR, getCourse, TRACK_LABEL } from '@/lib/courses';
import { useBookmarks } from '@/lib/useBookmarks';
import ItemCard from './ItemCard';
import PreviewModal from './PreviewModal';

export default function OmniSearch() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Item | null>(null);
  const { ids, toggle } = useBookmarks();

  // The search index can contain thousands of lectures. Do not download it
  // before the student even uses the search box (especially on mobile data).
  const searching = q.trim().length >= 2;
  useEffect(() => {
    if (!searching || loaded) return;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    supabase.from('items')
      .select('id,subject_slug,track,category,title,tags,badges,file_path,file_kind,attachments,external_url,uploader_name,status,exam_pick,description,created_at')
      .eq('status', 'approved').order('created_at', { ascending: true }).limit(2000)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (!error) { setItems((data as Item[]) || []); setLoaded(true); }
        else setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [searching, loaded]);

  const results = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (q.trim().length < 2) return [];
    return items.filter((i) => {
      const c = getCourse(i.subject_slug);
      const hay = [i.title, i.description, ...i.tags, c?.ar, c?.en, c?.instructors[i.track], CATEGORY_AR[i.category], TRACK_LABEL[i.track]]
        .filter(Boolean).join(' ').toLowerCase();
      return tokens.every((t) => hay.includes(t));
    }).slice(0, 40);
  }, [q, items]);

  return (
    <section aria-label="بحث شامل">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
          placeholder="ابحث بالعنوان أو المدرس أو الوسم أو الموضوع…"
          className="w-full rounded-xl border border-line bg-panel py-3 pe-3 ps-10 outline-none focus:border-brand" />
      </div>
      {searching && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-sm text-muted" role="status">جارٍ تحميل فهرس البحث لأول مرة…</p>}
          {!loading && loaded && results.length === 0 && <p className="text-sm text-muted">لا نتائج. جرّب كلمة أقصر أو اسم المادة.</p>}
          {loadFailed && <p className="text-sm text-muted">تعذّر تحميل البحث. تحقق من اتصالك وحاول إعادة فتح الصفحة.</p>}
          {results.map((i) => {
            const c = getCourse(i.subject_slug);
            const sub = `${c?.ar ?? ''}${i.track !== 'main' ? ` – ${TRACK_LABEL[i.track]}` : ''} – ${CATEGORY_AR[i.category]}`;
            return <ItemCard key={i.id} item={i} subtitle={sub} starred={ids.includes(i.id)} onStar={() => toggle(i.id)} onOpen={() => setOpen(i)} />;
          })}
        </div>
      )}
      <PreviewModal item={open} onClose={() => setOpen(null)} />
    </section>
  );
}
