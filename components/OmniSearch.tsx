'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Item } from '@/lib/types';
import { CATEGORY_AR, getCourse, TRACK_LABEL } from '@/lib/courses';
import { useBookmarks } from '@/lib/useBookmarks';
import ItemCard from './ItemCard';

// The PDF/document preview code loads only when the user opens a result.
const PreviewModal = dynamic(() => import('./PreviewModal'), { ssr: false });

type CachedResult = { items: Item[]; at: number };

export default function OmniSearch() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const recentQueries = useRef(new Map<string, CachedResult>());
  const { ids, toggle } = useBookmarks();

  const query = q.trim();
  const searching = query.length >= 2;

  useEffect(() => {
    if (query.length < 2) {
      setItems([]);
      setResultQuery('');
      setLoading(false);
      setLoadFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);

    // A short delay avoids a network request on every keystroke.
    const timer = window.setTimeout(async () => {
      const cached = recentQueries.current.get(query);
      if (cached && Date.now() - cached.at < 60_000) {
        setItems(cached.items);
        setResultQuery(query);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Search request failed');
        const data = await response.json() as { items?: Item[] };
        if (!Array.isArray(data.items)) throw new Error('Invalid search results');
        if (controller.signal.aborted) return;
        setItems(data.items);
        setResultQuery(query);
        setLoading(false);
        recentQueries.current.set(query, { items: data.items, at: Date.now() });
        // Keep only eight recent searches in memory, not a full lecture index.
        if (recentQueries.current.size > 8) {
          const oldest = recentQueries.current.keys().next().value;
          if (oldest) recentQueries.current.delete(oldest);
        }
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setResultQuery(query);
        setLoading(false);
        setLoadFailed(true);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Do not display old-query results while another request is in flight.
  const visible = resultQuery === query ? items : [];

  return (
    <section aria-label="بحث شامل">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
          maxLength={100}
          placeholder="ابحث بالعنوان أو المدرس أو الوسم أو الموضوع…"
          className="w-full rounded-xl border border-line bg-panel py-3 pe-3 ps-10 outline-none focus:border-brand" />
      </div>
      {searching && (
        <div className="mt-3 space-y-2" aria-live="polite">
          {loading && <p className="text-sm text-muted" role="status">جارٍ البحث…</p>}
          {!loading && !loadFailed && visible.length === 0 && <p className="text-sm text-muted">لا نتائج. جرّب كلمة أقصر أو اسم المادة.</p>}
          {loadFailed && <p className="text-sm text-muted" role="alert">تعذّر البحث. تأكد من اتصالك ثم حاول مرة أخرى.</p>}
          {!loading && !loadFailed && visible.map((item) => {
            const course = getCourse(item.subject_slug);
            const subtitle = `${course?.ar ?? ''}${item.track !== 'main' ? ` – ${TRACK_LABEL[item.track]}` : ''} – ${CATEGORY_AR[item.category]}`;
            return <ItemCard key={item.id} item={item} subtitle={subtitle} starred={ids.includes(item.id)} onStar={() => toggle(item.id)} onOpen={() => setOpen(item)} />;
          })}
        </div>
      )}
      {open && <PreviewModal item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
