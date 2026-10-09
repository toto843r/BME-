'use client';
import { useEffect, useMemo, useState } from 'react';
import { Star, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Item, Track } from '@/lib/types';
import { categoriesFor, type DisplayCategory } from '@/lib/courses';
import { useBookmarks } from '@/lib/useBookmarks';
import ItemCard from './ItemCard';
import PreviewModal from './PreviewModal';
import RecentFiles from './RecentFiles';


export default function SubjectView({ slug, track }: { slug: string; track: Track }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<DisplayCategory>('lectures');
  const [crunch, setCrunch] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [open, setOpen] = useState<{ item: Item; index: number } | null>(null);
  const { ids, toggle } = useBookmarks();

  useEffect(() => {
    try { setCrunch(localStorage.getItem('bme-crunch') === '1'); } catch {}
  }, []);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  // lets the header switch its upload button while the Videos tab is open
  useEffect(() => {
    const d = document.documentElement.dataset;
    d.tab = crunch ? 'crunch' : tab;
    d.slug = slug;
    d.track = track;
    return () => { delete d.tab; delete d.slug; delete d.track; };
  }, [tab, crunch, slug, track]);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setFailed(false);
    const cacheKey = `bme-public-files-v1-${slug}-${track}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) setItems(JSON.parse(saved) as Item[]);
    } catch {}
    supabase.from('items').select('*').eq('subject_slug', slug).eq('track', track).eq('status', 'approved')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { try { setFailed(!localStorage.getItem(cacheKey)); } catch { setFailed(true); } return; }
        const approved = (data as Item[]) || [];
        setItems(approved); setFailed(false);
        try {
          // Approved public metadata only; no large file content or private admin records.
          localStorage.setItem(cacheKey, JSON.stringify(approved.slice(0, 100)));
        } catch {}
      });
    return () => { cancelled = true; };
  }, [slug, track]);

  const setCrunchPersist = (v: boolean) => { setCrunch(v); try { localStorage.setItem('bme-crunch', v ? '1' : '0'); } catch {} };

  const visible = useMemo(
    () => (items || []).filter((i) => !favOnly || ids.includes(i.id)),
    [items, favOnly, ids],
  );
  const by = (c: DisplayCategory) => visible.filter((i) => c === 'exams_plus' ? slug === 'biomedical-sensors' && (i.category === 'quizzes' || i.category === 'midterms') : i.category === c);
  const card = (i: Item) => <ItemCard key={i.id} item={i} starred={ids.includes(i.id)} onStar={() => toggle(i.id)} onOpen={() => setOpen({ item: i, index: 0 })} />;

  return (
    <div>
      <RecentFiles slug={slug} track={track} items={items} onOpen={(item, index) => setOpen({ item, index })} />
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setCrunchPersist(!crunch)} aria-pressed={crunch}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${crunch ? 'border-now bg-now text-[#10242B]' : 'border-line bg-panel'}`}>
          <Zap size={16} /> مود ليلة الامتحان
        </button>
        <button onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${favOnly ? 'border-brand bg-brand/15' : 'border-line bg-panel'}`}>
          <Star size={16} /> المفضلة فقط
        </button>
      </div>

      {!crunch && (
        <div role="tablist" className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
          {categoriesFor(track, slug).map((c) => (
            <button key={c.key} role="tab" aria-selected={tab === c.key} onClick={() => setTab(c.key)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold ${tab === c.key ? 'bg-brand text-onbrand' : 'bg-panel text-muted border border-line'}`}>
              {c.ar}{c.key !== 'exams_plus' && <span className="ms-1 opacity-70">{by(c.key).length}</span>}
            </button>
          ))}
        </div>
      )}

      {failed && <p className="rounded-lg border border-line p-4 text-sm">تعذر تحميل الملفات. تحقق من اتصالك وأعد المحاولة.</p>}
      {items && offline && <p className="mb-3 rounded-lg bg-brand/10 p-3 text-sm text-muted">تعرض قائمة الملفات المحفوظة من آخر زيارة. يحتاج فتح PDF إلى الإنترنت.</p>}
      {!failed && items === null && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {items && !crunch && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tab === 'videos' && (
            <p className="mb-1 rounded-lg bg-brand/10 p-3 text-sm sm:col-span-2">هذا القسم مخصص لروابط الشروحات (فيديوهات وقنوات ومجلدات). الروابط تُفتح من هنا مباشرة.</p>
          )}
          {tab === 'reports' && (
            <p className="mb-1 rounded-lg bg-brand/10 p-3 text-sm sm:col-span-2">هذا القسم مخصص لتقارير المختبر.</p>
          )}
          {by(tab).length === 0 && (tab === 'videos'
            ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">لا تتوفر روابط شروحات حالياً.</p>
            : tab === 'reports'
              ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">لا تتوفر تقارير حالياً.</p>
              : <Empty />)}
          {by(tab).map(card)}
        </div>
      )}
      {items && crunch && (
        <div className="space-y-6">
          <p className="rounded-lg bg-now/20 p-3 text-sm">ملفات اختارها المشرف للمراجعة السريعة قبل الامتحان.</p>
          {categoriesFor(track, slug).map((cat) => {
            const list = by(cat.key).filter((i) => i.exam_pick);
            return list.length ? (
              <div key={cat.key}>
                <h3 className="mb-2 font-bold">{cat.ar}</h3>
                <div className="grid gap-2 sm:grid-cols-2">{list.map(card)}</div>
              </div>
            ) : null;
          })}
          {!visible.some((i) => i.exam_pick) && (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted sm:col-span-2">
              ما اختار المشرف ملفات لهذه المادة بعد. ارجع لاحقاً أو شوف التبويبات العادية.
            </p>
          )}
        </div>
      )}
      <PreviewModal item={open?.item ?? null} initialIndex={open?.index ?? 0} onClose={() => setOpen(null)} />
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted sm:col-span-2">
      لا توجد ملفات هنا بعد. إذا عندك ملف، ارفعه من «رفع ملف» في الأعلى.
    </p>
  );
}
