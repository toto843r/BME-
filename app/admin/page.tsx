'use client';
import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { BADGES, CATEGORY_AR, getCourse } from '@/lib/courses';
import { fileUrl } from '@/lib/supabase';
import type { Item } from '@/lib/types';

interface Report { id: string; reason: string | null; items: any }

export default function AdminPage() {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState<Item[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState('');

  async function call(action: string, extra: object = {}) {
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action, ...extra }) });
    return { ok: r.ok, j: await r.json() };
  }
  async function load() {
    const { ok, j } = await call('list');
    if (!ok) { setErr(j.error || 'خطأ'); setAuthed(false); return; }
    setErr(''); setAuthed(true); setPending(j.pending); setReports(j.reports);
  }
  async function act(action: string, id: string, extra: object = {}) {
    const { ok, j } = await call(action, { id, ...extra });
    if (!ok || j.error) setErr(j.error || 'فشلت العملية'); else load();
  }
  const toggleBadge = (id: string, b: string) =>
    setPicked((p) => ({ ...p, [id]: (p[id] || []).includes(b) ? p[id].filter((x) => x !== b) : [...(p[id] || []), b] }));
  const urlOf = (i: { file_path: string | null; external_url: string | null }) => (i.file_path ? fileUrl(i.file_path) : i.external_url || '#');

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
      {err && <p className="text-sm text-now">{err}</p>}

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
