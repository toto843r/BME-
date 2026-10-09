'use client';
import { useState } from 'react';
import { ArrowLeftRight, Check, Trash2, X, Zap } from 'lucide-react';
import { BADGES, CATEGORIES, categoriesFor, CATEGORY_AR, COURSES, getCourse } from '@/lib/courses';
import { fileUrl } from '@/lib/supabase';
import type { Item, Track } from '@/lib/types';

interface Report { id: string; reason: string | null; items: any }
interface Pub {
  id: string; title: string; subject_slug: string; track: string; category: string;
  file_path: string | null; external_url: string | null; exam_pick?: boolean; description?: string | null;
}

const sel = 'w-full rounded-lg border border-line bg-bg px-2 py-2 text-sm';
const trackOptions = (slug: string): [string, string][] =>
  getCourse(slug)?.split ? [['theory', 'نظري'], ['lab', 'مختبر']] : [['main', 'نظري']];

export default function AdminPage() {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState<Item[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [approved, setApproved] = useState<Pub[]>([]);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [mSlug, setMSlug] = useState('');
  const [mTrack, setMTrack] = useState('theory');
  const [mCat, setMCat] = useState('lectures');
  const [mDesc, setMDesc] = useState('');
  const [err, setErr] = useState('');

  async function call(action: string, extra: object = {}) {
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action, ...extra }) });
    return { ok: r.ok, j: await r.json() };
  }
  async function load() {
    const { ok, j } = await call('list');
    if (!ok) { setErr(j.error || 'خطأ'); setAuthed(false); return; }
    setErr(''); setAuthed(true); setPending(j.pending); setReports(j.reports); setApproved(j.approved || []);
  }
  async function act(action: string, id: string, extra: object = {}) {
    const { ok, j } = await call(action, { id, ...extra });
    if (!ok || j.error) setErr(j.error || 'فشلت العملية'); else { setErr(''); load(); }
  }
  const toggleBadge = (id: string, b: string) =>
    setPicked((p) => ({ ...p, [id]: (p[id] || []).includes(b) ? p[id].filter((x) => x !== b) : [...(p[id] || []), b] }));
  const urlOf = (i: { file_path: string | null; external_url: string | null }) => (i.file_path ? fileUrl(i.file_path) : i.external_url || '#');

  function startMove(i: Pub) {
    if (moving === i.id) return setMoving(null);
    setMoving(i.id); setMSlug(i.subject_slug); setMCat(i.category); setMDesc(i.description || '');
    setMTrack(getCourse(i.subject_slug)?.split ? (i.track === 'lab' ? 'lab' : 'theory') : 'main');
  }
  const validCat = (t: string, cat: string, isFile: boolean) => {
    const list = categoriesFor(t as Track).filter((c) => (c.key === 'videos') === !isFile);
    return list.some((c) => c.key === cat) ? cat : (list[0]?.key ?? cat);
  };
  function changeCourse(slug: string, isFile: boolean) {
    const t = getCourse(slug)?.split ? 'theory' : 'main';
    setMSlug(slug); setMTrack(t); setMCat((c) => validCat(t, c, isFile));
  }

  const q = filter.trim().toLowerCase();
  const matches = (i: Pub) => !q || (i.title + ' ' + (getCourse(i.subject_slug)?.ar || '')).toLowerCase().includes(q);
  const known = new Set(COURSES.map((c) => c.slug));
  const orphans = approved.filter((i) => !known.has(i.subject_slug) && matches(i));

  const row = (i: Pub) => (
    <div key={i.id} className="rounded-lg border border-line bg-bg p-2.5">
      <div className="flex items-center gap-2">
        <a href={urlOf(i)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand underline">{i.title}</a>
        <button onClick={() => act('toggle_pick', i.id, { value: !i.exam_pick })} aria-pressed={!!i.exam_pick}
          aria-label="ضمن مود ليلة الامتحان" title="ضمن مود ليلة الامتحان"
          className={`rounded-lg border p-2 ${i.exam_pick ? 'border-now bg-now text-[#10242B]' : 'border-line text-muted'}`}>
          <Zap size={16} />
        </button>
        <button onClick={() => startMove(i)} aria-label="تعديل أو نقل" className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm">
          <ArrowLeftRight size={15} /> تعديل
        </button>
        <button onClick={() => window.confirm('حذف هذا الملف نهائياً؟') && act('remove_item', i.id)} aria-label="حذف"
          className="rounded-lg border border-now p-2"><Trash2 size={16} /></button>
      </div>
      {i.description && moving !== i.id && <p className="mt-1.5 whitespace-pre-line text-xs text-muted">{i.description}</p>}
      {moving === i.id && (
        <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
          <select className={sel} value={mSlug} onChange={(e) => changeCourse(e.target.value, !!i.file_path)}>
            {COURSES.map((c) => <option key={c.slug} value={c.slug}>{c.ar}</option>)}
          </select>
          <select className={sel} value={mTrack} onChange={(e) => { setMTrack(e.target.value); setMCat((c) => validCat(e.target.value, c, !!i.file_path)); }}>
            {trackOptions(mSlug).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={sel} value={mCat} onChange={(e) => setMCat(e.target.value)}>
            {categoriesFor(mTrack as Track).filter((c) => (c.key === 'videos') === !i.file_path).map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
          </select>
          <textarea className={sel} rows={3} maxLength={500} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="وصف الملف (اختياري)" />
          <div className="flex gap-2">
            <button onClick={() => { act('move_item', i.id, { slug: mSlug, track: mTrack, category: mCat, description: mDesc }); setMoving(null); }}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-onbrand">حفظ</button>
            <button onClick={() => setMoving(null)} className="rounded-lg border border-line px-4 py-2 text-sm">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );

  if (!authed) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mx-auto max-w-xs space-y-3">
        <h1 className="text-2xl font-bold">لوحة المشرف</h1>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" autoComplete="off"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2.5" dir="ltr" />
        <button className="w-full rounded-lg bg-brand py-2.5 font-bold text-onbrand">دخول</button>
        {err && <p className="text-sm text-now">{err}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">لوحة المشرف</h1>
      {err && <p className="rounded-lg border border-now p-3 text-sm">{err}</p>}

      <section>
        <h2 className="mb-3 text-lg font-bold">بانتظار المراجعة ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted">لا شيء بانتظار المراجعة.</p>}
        <div className="space-y-3">
          {pending.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3">
              <a href={urlOf(i)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">{i.title}</a>
              <p className="mt-0.5 text-xs text-muted">
                {getCourse(i.subject_slug)?.ar} – {i.track === 'main' ? '' : i.track === 'lab' ? 'مختبر – ' : 'نظري – '}{CATEGORY_AR[i.category]}
                {i.uploader_name && ` – من ${i.uploader_name}`}
              </p>
              {i.description && <p className="mt-1.5 whitespace-pre-line text-sm">{i.description}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {BADGES.map((b) => (
                  <label key={b.key} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={(picked[i.id] || []).includes(b.key)} onChange={() => toggleBadge(i.id, b.key)} /> {b.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => act('approve', i.id, { badges: picked[i.id] || [] })} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-onbrand"><Check size={15} /> قبول</button>
                <button onClick={() => act('reject', i.id)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm"><X size={15} /> رفض وحذف الملف</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold">الملفات المنشورة ({approved.length})</h2>
        <p className="mb-3 text-sm text-muted">زر ⚡ الأصفر = الملف يظهر في «مود ليلة الامتحان» لمادته ({approved.filter((i) => i.exam_pick).length} ملف مختار).</p>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ابحث بالعنوان أو المادة"
          className="mb-3 w-full rounded-lg border border-line bg-panel px-3 py-2.5" />
        {approved.length === 0 && <p className="text-sm text-muted">لا توجد ملفات منشورة بعد.</p>}
        <div className="space-y-2.5">
          {COURSES.map((c) => {
            const list = approved.filter((i) => i.subject_slug === c.slug && matches(i));
            if (!list.length) return null;
            const tracks = c.split ? ['theory', 'lab'] : ['main'];
            return (
              <details key={c.slug} open={q ? true : undefined} className="rounded-xl border border-line bg-panel">
                <summary className="cursor-pointer p-3 font-bold">{c.ar} <span className="font-normal text-muted">({list.length})</span></summary>
                <div className="space-y-4 border-t border-line p-3">
                  {tracks.map((t) => {
                    const tl = list.filter((i) => i.track === t);
                    if (!tl.length) return null;
                    return (
                      <div key={t} className="space-y-3">
                        {c.split && <h3 className="font-semibold text-brand">{t === 'lab' ? 'مختبر' : 'نظري'} ({tl.length})</h3>}
                        {CATEGORIES.map((cat) => {
                          const l = tl.filter((i) => i.category === cat.key);
                          if (!l.length) return null;
                          return (
                            <div key={cat.key}>
                              <h4 className="mb-1.5 text-sm font-semibold text-muted">{cat.ar} ({l.length})</h4>
                              <div className="space-y-2">{l.map(row)}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
          {orphans.length > 0 && (
            <details open className="rounded-xl border border-now bg-panel">
              <summary className="cursor-pointer p-3 font-bold">ملفات تابعة لمادة محذوفة <span className="font-normal text-muted">({orphans.length})</span></summary>
              <div className="space-y-2 border-t border-line p-3">{orphans.map(row)}</div>
            </details>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">بلاغات ({reports.length})</h2>
        {reports.length === 0 && <p className="text-sm text-muted">لا بلاغات مفتوحة.</p>}
        <div className="space-y-3">
          {reports.map((r) => {
            const it = Array.isArray(r.items) ? r.items[0] : r.items;
            return (
              <div key={r.id} className="rounded-xl border border-line bg-panel p-3">
                {it && <a href={urlOf(it)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">{it.title}</a>}
                <p className="mt-0.5 text-sm">{r.reason || 'بدون وصف'}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => act('resolve_report', r.id)} className="rounded-lg border border-line px-3 py-1.5 text-sm">تم الحل</button>
                  {it && <button onClick={() => window.confirm('حذف الملف نهائياً؟') && act('remove_item', it.id)} className="flex items-center gap-1 rounded-lg border border-now px-3 py-1.5 text-sm"><Trash2 size={15} /> حذف الملف</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
