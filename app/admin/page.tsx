'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeftRight, Check, Trash2, X, Zap, Pencil, ChevronDown, Upload, Megaphone } from 'lucide-react';
import UploadForm from '@/components/UploadForm';
import { BADGES, categoriesFor, CATEGORY_AR, COURSES, getCourse } from '@/lib/courses';
import { fileUrl } from '@/lib/supabase';
import type { Item, Track } from '@/lib/types';

interface Notice { id: string; message: string; expires_at: string }
interface Report { id: string; reason: string | null; items: any }
interface Pub {
  id: string; title: string; subject_slug: string; track: string; category: string;
  file_path: string | null; external_url: string | null; exam_pick?: boolean; description?: string | null; file_kind?: string;
  attachments?: {path: string;kind: string;name?: string}[];
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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [attachmentNames, setAttachmentNames] = useState<Record<string, string>>({});
  const [editMenu, setEditMenu] = useState<string | null>(null);
  const [mSlug, setMSlug] = useState('');
  const [mTrack, setMTrack] = useState('theory');
  const [mCat, setMCat] = useState('lectures');
  const [mDesc, setMDesc] = useState('');
  const [err, setErr] = useState('');
  const [previewOnly, setPreviewOnly] = useState(false);
  const [oldQuizBusy, setOldQuizBusy] = useState(false);
  const [oldQuizMessage, setOldQuizMessage] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [noticeFeedback, setNoticeFeedback] = useState('');

  async function call(action: string, extra: object = {}) {
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action, ...extra }) });
    return { ok: r.ok, j: await r.json() };
  }
  async function publishNotice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = noticeText.trim();
    if (noticeBusy || !message || message.length > 400) return;
    setNoticeBusy(true); setNoticeFeedback('');
    try {
      const { ok, j } = await call('publish_notice', { message });
      if (!ok) { setNoticeFeedback(j.error || 'تعذر إرسال التبليغ.'); return; }
      setActiveNotice(j.notice);
      setNoticeText('');
      setNoticeFeedback('تم نشر التبليغ بنجاح لمدة 4 ساعات.');
    } catch { setNoticeFeedback('تعذر الاتصال بالخادم. حاول بعد قليل.'); }
    finally { setNoticeBusy(false); }
  }
  async function clearNotice() {
    if (noticeBusy || !window.confirm('مسح التبليغ الحالي فوراً؟')) return;
    setNoticeBusy(true); setNoticeFeedback('');
    try {
      const { ok, j } = await call('clear_notice');
      if (!ok) { setNoticeFeedback(j.error || 'تعذر مسح التبليغ.'); return; }
      setActiveNotice(null);
      setNoticeFeedback('تم مسح التبليغ.');
    } catch { setNoticeFeedback('تعذر الاتصال بالخادم. حاول بعد قليل.'); }
    finally { setNoticeBusy(false); }
  }
  async function prepareOldQuiz() {
    if (oldQuizBusy) return;
    setOldQuizBusy(true);
    setOldQuizMessage('جارٍ تجهيز ملزمة واحدة؛ قد يستغرق ذلك دقيقة...');
    try {
      const { ok, j } = await call('prepare_old_quiz');
      setOldQuizMessage(j.message || j.error || (ok ? 'اكتملت المحاولة.' : 'تعذرت العملية.'));
    } catch {
      setOldQuizMessage('تعذر الاتصال بالخادم؛ لا تعِد المحاولة مباشرة إذا كانت العملية مستمرة.');
    } finally {
      setOldQuizBusy(false);
    }
  }
  async function load() {
    const { ok, j } = await call('list');
    if (!ok) { setErr(j.error || 'خطأ'); setAuthed(false); return; }
    setErr(''); setAuthed(true); setPending(j.pending); setReports(j.reports); setApproved(j.approved || []); setActiveNotice(j.notice || null); setPreviewOnly(Boolean(j.previewOnly));
  }
  async function act(action: string, id: string, extra: object = {}) {
    const { ok, j } = await call(action, { id, ...extra });
    if (!ok || j.error) { setErr(j.error || 'فشلت العملية'); return false; }
    setErr('');
    // Approval publishes the material; quiz preparation starts on upload.
    void load();
    return true;
  }
  const toggleBadge = (id: string, b: string) =>
    setPicked((p) => ({ ...p, [id]: (p[id] || []).includes(b) ? p[id].filter((x) => x !== b) : [...(p[id] || []), b] }));
  const urlOf = (i: { file_path: string | null; external_url: string | null }) => (i.file_path ? fileUrl(i.file_path) : i.external_url || '#');

  function startMove(i: Pub) {
    setEditMenu(null); setRenaming(null);
    if (moving === i.id) return setMoving(null);
    setMoving(i.id); setMSlug(i.subject_slug); setMCat(i.subject_slug === 'biomedical-sensors' && ['quizzes', 'midterms'].includes(i.category) ? 'exams_plus' : i.category); setMDesc(i.description || '');
    setMTrack(getCourse(i.subject_slug)?.split ? (i.track === 'lab' ? 'lab' : 'theory') : 'main');
  }
  // text posts -> quizzes/midterms/finals only; links -> videos only; files -> everything else
  const catOk = (i: Pub, key: string) =>
    i.file_kind === 'text' ? ['quizzes', 'midterms', 'finals', 'exams_plus'].includes(key) : (key === 'videos') === !i.file_path;
  const validCat = (t: string, cat: string, i: Pub, slug = mSlug) => {
    const list = categoriesFor(t as Track, slug).filter((c) => catOk(i, c.key));
    return list.some((c) => c.key === cat) ? cat : (list[0]?.key ?? cat);
  };
  function changeCourse(slug: string, i: Pub) {
    const t = getCourse(slug)?.split ? 'theory' : 'main';
    setMSlug(slug); setMTrack(t); setMCat((c) => validCat(t, c, i, slug));
  }
  const titleLink = (i: { title: string; file_path: string | null; external_url: string | null }, cls: string) =>
    i.file_path || i.external_url
      ? <a href={urlOf(i)} target="_blank" rel="noopener noreferrer" className={`${cls} text-brand underline`}>{i.title}</a>
      : <span className={cls}>{i.title} <span className="text-xs text-muted">(نص)</span></span>;

  const q = filter.trim().toLowerCase();
  const matches = (i: Pub) => !q || (i.title + ' ' + (getCourse(i.subject_slug)?.ar || '')).toLowerCase().includes(q);
  const known = new Set(COURSES.map((c) => c.slug));
  const orphans = approved.filter((i) => !known.has(i.subject_slug) && matches(i));

  const row = (i: Pub) => (
    <div key={i.id} className="rounded-lg border border-line bg-bg p-2.5">
      <div className="flex items-center gap-2">
        {titleLink(i, 'min-w-0 flex-1 truncate font-medium')}
        <button onClick={() => act('toggle_pick', i.id, { value: !i.exam_pick })} aria-pressed={!!i.exam_pick}
          aria-label="ضمن مود ليلة الامتحان" title="ضمن مود ليلة الامتحان"
          className={`rounded-lg border p-2 ${i.exam_pick ? 'border-now bg-now text-[#10242B]' : 'border-line text-muted'}`}>
          <Zap size={16} />
        </button>
        <div className="relative">
          <button type="button" onClick={() => setEditMenu((m) => m === i.id ? null : i.id)}
            aria-label="خيارات تعديل الملف" aria-expanded={editMenu === i.id}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm">
            <Pencil size={15} /> تعديل <ChevronDown size={14} />
          </button>
          {editMenu === i.id && <div className="absolute end-0 top-full z-20 mt-1 min-w-40 space-y-1 rounded-xl border border-line bg-panel p-1.5 shadow-lg">
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-line/60"
              onClick={() => { setNewTitle(i.title); setAttachmentNames(Object.fromEntries((i.attachments || []).map((a) => [a.path, a.name || 'ملف إضافي']))); setRenaming(i.id); setMoving(null); setEditMenu(null); }}>
              <Pencil size={15} /> تعديل الاسم
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-line/60"
              onClick={() => startMove(i)}>
              <ArrowLeftRight size={15} /> نقل إلى قسم آخر
            </button>
          </div>}
        </div>
        <button onClick={() => window.confirm('حذف هذا الملف نهائياً؟') && act('remove_item', i.id)} aria-label="حذف"
          className="rounded-lg border border-now p-2"><Trash2 size={16} /></button>
      </div>
      {i.description && moving !== i.id && <p className="mt-1.5 whitespace-pre-line text-xs text-muted">{i.description}</p>}
      {renaming === i.id && (
        <form className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2"
          onSubmit={async (e) => { e.preventDefault(); if (await act('rename_item', i.id, { title: newTitle, attachmentNames: (i.attachments || []).map((a) => ({ path: a.path, name: attachmentNames[a.path] || a.name || 'ملف إضافي' })) })) setRenaming(null); }}>
          <label className="w-full text-xs text-muted">اسم الملف الرئيسي
            <input required minLength={2} maxLength={200} value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              aria-label="الاسم الجديد" className={`${sel} mt-1`} />
          </label>
          {(i.attachments || []).map((a, n) => <label key={a.path} className="w-full text-xs text-muted">اسم الملف الإضافي {n + 2}
            <input required minLength={2} maxLength={200} value={attachmentNames[a.path] || ''}
              onChange={(e) => setAttachmentNames((prev) => ({ ...prev, [a.path]: e.target.value }))} className={`${sel} mt-1`} />
          </label>)}
          <button type="submit" className="rounded-lg bg-brand px-3 py-2 text-sm text-onbrand">حفظ الأسماء</button>
          <button type="button" onClick={() => setRenaming(null)} className="rounded-lg border border-line px-3 py-2 text-sm">إلغاء</button>
        </form>
      )}
      {moving === i.id && (
        <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
          <select className={sel} value={mSlug} onChange={(e) => changeCourse(e.target.value, i)}>
            {COURSES.map((c) => <option key={c.slug} value={c.slug}>{c.ar}</option>)}
          </select>
          <select className={sel} value={mTrack} onChange={(e) => { setMTrack(e.target.value); setMCat((c) => validCat(e.target.value, c, i)); }}>
            {trackOptions(mSlug).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={sel} value={mCat} onChange={(e) => setMCat(e.target.value)}>
            {categoriesFor(mTrack as Track, mSlug).filter((c) => catOk(i, c.key)).map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
          </select>
          <textarea className={sel} rows={6} maxLength={5000} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="وصف الملف (اختياري)" />
          <div className="flex gap-2">
            <button onClick={async () => { if (await act('move_item', i.id, { slug: mSlug, track: mTrack, category: mCat, description: mDesc })) setMoving(null); }}
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
        <Link href="/" className="inline-block text-sm text-muted hover:text-ink">← الرئيسية</Link>
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
      <Link href="/" className="inline-block text-sm text-muted hover:text-ink">← الرئيسية</Link>
        <h1 className="text-2xl font-bold">لوحة المشرف</h1>
      {err && <p className="rounded-lg border border-now p-3 text-sm">{err}</p>}

      <section className="space-y-3 rounded-xl border border-line bg-panel p-4" aria-labelledby="admin-notice-heading">
        <h2 id="admin-notice-heading" className="flex items-center gap-2 text-lg font-bold"><Megaphone size={20} /> التبليغات</h2>
        <p className="text-sm text-muted">التبليغ يظهر أعلى الجدول عند دخول الطلاب، ويختفي تلقائياً بعد 4 ساعات. يمكن مسحه في أي وقت.</p>
        {activeNotice && (
          <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
            <p className="text-xs font-semibold text-brand">التبليغ الحالي</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{activeNotice.message}</p>
            <p className="mt-1 text-xs text-muted">ينتهي: {new Date(activeNotice.expires_at).toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })}</p>
            <button type="button" disabled={noticeBusy} onClick={clearNotice}
              className="mt-2 flex items-center gap-1 rounded-lg border border-now px-3 py-1.5 text-sm text-ink disabled:opacity-50">
              <Trash2 size={15} /> مسح التبليغ الآن
            </button>
          </div>
        )}
        <form onSubmit={publishNotice} className="space-y-2">
          <label htmlFor="notice-text" className="text-sm font-semibold">نص التبليغ الجديد</label>
          <textarea id="notice-text" rows={3} maxLength={400} required value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)} placeholder="مثلاً: تم تغيير قاعة المحاضرة القادمة إلى BME 4"
            className="w-full resize-y rounded-lg border border-line bg-bg p-3 text-sm" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{noticeText.length}/400 حرف</span>
            <button type="submit" disabled={noticeBusy || !noticeText.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-onbrand disabled:opacity-50">
              {noticeBusy ? 'جارٍ الحفظ...' : 'إرسال التبليغ'}
            </button>
          </div>
        </form>
        {noticeFeedback && <p role="status" className="text-sm text-brand">{noticeFeedback}</p>}
      </section>

      <details className="rounded-xl border border-line bg-panel p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-lg font-bold"><Upload size={19} /> رفع ملفات المشرف (بدون موافقة)</summary>
        <div className="mt-4 border-t border-line pt-4">
          <UploadForm adminPin={pin} embedded onPublished={() => { void load(); }} />
        </div>
      </details>

      {previewOnly && <section className="rounded-xl border border-line bg-panel p-4 space-y-2">
        <h2 className="font-bold">تجربة تجهيز الملازم القديمة</h2>
        <p className="text-sm text-muted">في النسخة التجريبية فقط: جهّز أسئلة ملزمة قديمة واحدة بدون إعادة رفعها. الأسئلة المحفوظة لا تتكرر، ولا تتغير بيانات الملازم.</p>
        <button type="button" disabled={oldQuizBusy} onClick={prepareOldQuiz}
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand disabled:opacity-50">
          {oldQuizBusy ? 'جارٍ التجهيز...' : 'تجهيز أسئلة ملزمة قديمة واحدة'}
        </button>
        {oldQuizMessage && <p role="status" className="text-sm text-muted">{oldQuizMessage}</p>}
      </section>}

      <section>
        <h2 className="mb-3 text-lg font-bold">بانتظار المراجعة ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted">لا شيء بانتظار المراجعة.</p>}
        <div className="space-y-3">
          {pending.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3">
              {titleLink(i, 'font-semibold')}
              {(i.attachments || []).length > 0 && (
                <span className="ms-2 text-xs text-muted">
                  {(i.attachments || []).map((a, n) => (
                    <a key={a.path} href={fileUrl(a.path)} target="_blank" rel="noopener noreferrer" className="me-2 text-brand underline">ملف {n + 2}</a>
                  ))}
                </span>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {getCourse(i.subject_slug)?.ar} – {i.track === 'main' ? '' : i.track === 'lab' ? 'مختبر – ' : 'نظري – '}{i.subject_slug === 'biomedical-sensors' && ['quizzes','midterms'].includes(i.category) ? 'الامتحانات' : CATEGORY_AR[i.category]}
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
                        {categoriesFor(t as Track, c.slug).map((cat) => {
                          const l = tl.filter((i) => cat.key === 'exams_plus' ? ['quizzes', 'midterms'].includes(i.category) : i.category === cat.key);
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
                {it && titleLink(it, 'font-semibold')}
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
