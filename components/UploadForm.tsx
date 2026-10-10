'use client';
import BackButton from '@/components/BackButton';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BUCKET, supabase } from '@/lib/supabase';
import { CATEGORIES, categoriesFor, COURSES, getCourse, normalizeCategory, type DisplayCategory } from '@/lib/courses';
import { EXT_MIME, kindFromExt } from '@/lib/media';
import type { Category, Track } from '@/lib/types';

const MAX = 30 * 1024 * 1024;
const MAX_FILES = 10;
const field = 'w-full rounded-lg border border-line bg-panel px-3 py-2.5 outline-none focus:border-brand';

export default function UploadForm({ adminPin, embedded = false, onPublished }: { adminPin?: string; embedded?: boolean; onPublished?: () => void } = {}) {
  const [slug, setSlug] = useState(COURSES[0].slug);
  const [track, setTrack] = useState<Track>('theory');
  const [category, setCategory] = useState<DisplayCategory>('lectures');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sl = q.get('slug'), c = q.get('category'), t = q.get('track');
    if (sl && getCourse(sl)) setSlug(sl);
    if (c && (CATEGORIES.some((x) => x.key === c) || c === 'exams_plus')) setCategory(c as DisplayCategory);
    if (t === 'theory' || t === 'lab') setTrack(t);
  }, []);

  const course = getCourse(slug)!;
  const isVideo = category === 'videos';
  const hasDesc = ['quizzes', 'midterms', 'finals', 'exams_plus'].includes(category);
  const effTrack: Track = course.split ? (track === 'main' ? 'theory' : track) : 'main';

  useEffect(() => {
    if (!categoriesFor(effTrack, slug).some((c) => c.key === category)) setCategory('lectures');
  }, [effTrack, category]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list); // copy NOW: clearing the input empties the live FileList
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (title.trim().length < 2) return setMsg({ ok: false, text: 'اكتب عنواناً واضحاً.' });
    if (isVideo && !/^https?:\/\//i.test(url)) return setMsg({ ok: false, text: 'ضع رابطاً صحيحاً يبدأ بـ https://' });
    if (!isVideo && files.length === 0 && !(hasDesc && desc.trim()))
      return setMsg({ ok: false, text: hasDesc ? 'اختر ملفاً أو اكتب نص الأسئلة.' : 'اختر ملفاً.' });
    if (files.some((f) => f.size > MAX)) return setMsg({ ok: false, text: 'أحد الملفات أكبر من 30 ميغابايت.' });

    setBusy(true);
    try {
      const uploaded: { path: string; kind: string; name: string }[] = [];
      const uploadOne = async (f: File) => {
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const r = await fetch(adminPin ? '/api/admin' : '/api/upload/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, size: f.size, ...(adminPin ? { pin: adminPin, action: 'sign_admin_upload' } : {}) }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'sign');
        const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(j.path, j.token, f, { contentType: EXT_MIME[ext] });
        if (up.error) throw up.error;
        return { path: j.path as string, kind: kindFromExt(ext), name: f.name };
      };
      if (!isVideo) {
        for (let n = 0; n < files.length; n++) {
          setProgress(`جارٍ رفع ${n + 1} من ${files.length}…`);
          let done: { path: string; kind: string; name: string } | null = null;
          for (let attempt = 0; attempt < 2 && !done; attempt++) {   // one automatic retry per file
            try { done = await uploadOne(files[n]); } catch (e) { if (attempt === 1) throw e; }
          }
          uploaded.push(done!);
        }
        if (uploaded.length !== files.length) throw new Error('لم تكتمل رفع كل الملفات، حاول مرة ثانية.');
      }
      setProgress('جارٍ الحفظ…');
      // Publish through the PIN-authenticated server endpoint for admins;
      // student uploads keep the original pending/RLS path unchanged.
      let itemId: string;
      if (adminPin) {
        const res = await fetch('/api/admin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: adminPin, action: 'create_admin_item', slug, track: effTrack, category,
            title: title.trim(), description: hasDesc ? desc.trim() : '',
            tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
            files: uploaded, url: isVideo ? url.trim() : null }),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error || 'تعذر النشر المباشر');
        itemId = result.id;
      } else {
        // Pending items can be inserted anonymously under existing Supabase RLS.
        itemId = crypto.randomUUID();
        const { error } = await supabase.from('items').insert({
          id: itemId, subject_slug: slug, track: effTrack, category: normalizeCategory(category), title: title.trim(),
          tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
          file_path: uploaded[0]?.path ?? null,
          file_kind: isVideo ? 'video' : uploaded[0]?.kind ?? 'text',
          attachments: uploaded.slice(1),
          external_url: isVideo ? url.trim() : null,
          uploader_name: name.trim() || null,
          description: hasDesc ? desc.trim().slice(0, 5000) || null : null,
        });
        if (error) throw error;
      }
      // Fire-and-forget after the database insert: the user never waits for Gemini.
      // The server verifies the new pending lecture and its PDF paths. A daily
      // production reconciliation job picks up anything interrupted.
      if (category === 'lectures' && uploaded.some((entry) => entry.kind === 'pdf')) {
        void fetch('/api/quiz/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, ...(adminPin ? { adminPin } : {}) }),
          cache: 'no-store',
          // Keep the small trigger request alive if the student leaves the page.
          // The PDF is NOT uploaded twice and no quiz data is sent from the browser.
          keepalive: true,
        }).catch(() => { /* Scheduled reconciliation retries in Production. */ });
      }
      setMsg({ ok: true, text: adminPin ? 'نُشر الملف مباشرة بنجاح. تُجهّز أسئلة PDF تلقائياً إذا كانت ملزمة.' : 'تم الرفع بنجاح وهو بانتظار مراجعة المشرف للنشر. تُجهّز أسئلة PDF تلقائياً بالخلفية.' });
      if (adminPin) onPublished?.();
      setTitle(''); setDesc(''); setTags(''); setUrl(''); setFiles([]);
    } catch (err: any) {
      setMsg({ ok: false, text: `فشل الرفع: ${err?.message || 'خطأ غير معروف'}` });
    } finally { setBusy(false); setProgress(''); }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4">
      {!embedded && <BackButton fallback="/" />}
      <h1 className="text-2xl font-bold">{adminPin ? 'رفع ملف من المشرف' : 'رفع ملف'}</h1>
      <p className="text-sm text-muted">{adminPin ? 'ملفات المشرف تُنشر مباشرة بدون انتظار الموافقة.' : 'كل رفعة تمر على مراجعة المشرف قبل ظهورها.'} الصيغ: PDF، صور، Word، PowerPoint (حتى 30 ميغابايت للملف).</p>

      <label className="block"><span className="mb-1 block text-sm">المادة</span>
        <select className={field} value={slug} onChange={(e) => setSlug(e.target.value)}>
          {COURSES.map((c) => <option key={c.slug} value={c.slug}>{c.ar}</option>)}
        </select></label>

      {course.split && (
        <label className="block"><span className="mb-1 block text-sm">المسار</span>
          <select className={field} value={effTrack} onChange={(e) => setTrack(e.target.value as Track)}>
            <option value="theory">نظري</option><option value="lab">مختبر</option>
          </select></label>
      )}

      <label className="block"><span className="mb-1 block text-sm">القسم</span>
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {categoriesFor(effTrack, slug).map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
        </select></label>
      <p className="-mt-2 text-xs text-muted">
        {isVideo ? 'قسم الشروحات روابط فقط، ولا يقبل رفع ملفات.' : 'هذا القسم ملفات فقط. الروابط تُضاف في قسم الشروحات.'}
      </p>

      <label className="block"><span className="mb-1 block text-sm">العنوان</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="مثال: فاينل 2024 – الدور الأول" /></label>

      {hasDesc && (
        <label className="block"><span className="mb-1 block text-sm">النص أو الوصف</span>
          <textarea className={field} rows={7} maxLength={5000} value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="اكتب الأسئلة هنا إذا ما عندك ملف، أو أضف وصفاً يظهر تحت الصور/الملفات" />
          <span className="mt-1 block text-xs text-muted">{desc.length}/5000 – تقدر تكتب النص فقط بدون رفع ملف</span></label>
      )}

      {isVideo ? (
        <label className="block"><span className="mb-1 block text-sm">رابط الشرح (YouTube أو Google Drive أو تلكرام أو أي رابط)</span>
          <input className={field} dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/..." /></label>
      ) : (
        <div>
          <span className="mb-1 block text-sm">
            {hasDesc ? 'الملفات أو الصور (اختياري إذا كتبت النص)' : 'الملفات'} – حتى {MAX_FILES} ملفات برسالة واحدة، وتظهر بنفس ترتيب اختيارها
          </span>
          <input type="file" multiple className={field} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate" dir="ltr" style={{ textAlign: 'start' }}>{f.name}</span>
                  <span className="text-xs text-muted">{(f.size / 1048576).toFixed(1)} MB</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, k) => k !== i))} aria-label="إزالة" className="p-1 text-muted"><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block"><span className="mb-1 block text-sm">وسوم (مفصولة بفاصلة)</span>
        <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ch3, op-amp, 2024" /></label>
      <label className="block"><span className="mb-1 block text-sm">اسمك (اختياري)</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>

      <button disabled={busy} className="w-full rounded-lg bg-brand py-3 font-bold text-onbrand disabled:opacity-60">
        {busy ? progress || 'جارٍ الرفع…' : adminPin ? 'نشر مباشرة' : 'إرسال للمراجعة'}
      </button>
      {msg && <p role="status" className={`rounded-lg border p-3 text-sm ${msg.ok ? 'border-brand' : 'border-now'}`}>{msg.text}</p>}
    </form>
  );
}
