import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { COURSES } from '@/lib/courses';
import { generateQuiz } from '@/lib/quizGenerator';
import { EXT_MIME, kindFromExt } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 150;

const sha = (s: string) => createHash('sha256').update(s).digest();
const BADGES = ['high_yield', 'past_final', 'simplified'];
const fails = new Map<string, { n: number; t: number }>(); // best-effort throttle (per server instance)

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rec = fails.get(ip);
  const recent = rec && Date.now() - rec.t < 10 * 60 * 1000;
  if (recent && rec!.n >= 5) return NextResponse.json({ error: 'محاولات كثيرة، انتظر 10 دقائق.' }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }

  const pin = process.env.ADMIN_PIN || '';
  if (!pin || !timingSafeEqual(sha(String(body.pin ?? '')), sha(pin))) {
    fails.set(ip, { n: (recent ? rec!.n : 0) + 1, t: Date.now() });
    return NextResponse.json({ error: 'PIN غير صحيح' }, { status: 401 });
  }
  fails.delete(ip);

  const db = supabaseAdmin();
  const id = String(body.id || '');

  async function removeFile(itemId: string) {
    const { data } = await db.from('items').select('file_path, attachments').eq('id', itemId).single();
    const extra = ((data?.attachments as { path: string }[] | null) || []).map((x) => x.path);
    const paths = [data?.file_path, ...extra].filter(Boolean) as string[];
    const safe: string[] = []; // skip any path another item also points to
    for (const p of paths) {
      const a = await db.from('items').select('id', { count: 'exact', head: true }).neq('id', itemId).eq('file_path', p);
      const b = await db.from('items').select('id', { count: 'exact', head: true }).neq('id', itemId).contains('attachments', [{ path: p }]);
      if (!a.count && !b.count) safe.push(p);
    }
    if (safe.length) await db.storage.from('materials').remove(safe);
  }

  switch (body.action) {
    case 'publish_notice': {
      const message = String(body.message ?? '').trim();
      if (!message || message.length > 400) {
        return NextResponse.json({ error: 'التبليغ لازم يكون من حرف إلى 400 حرف.' }, { status: 400 });
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      const { data: newNotice, error } = await db.from('portal_notices')
        .insert({ message, expires_at: expiresAt })
        .select('id, message, created_at, expires_at')
        .single();
      if (error || !newNotice) {
        return NextResponse.json({ error: 'تعذر نشر التبليغ. تأكد من تشغيل portal_notices.sql في Supabase.' }, { status: 500 });
      }
      // When sending a new notice, retire earlier active notices so only one shows.
      const { error: retireError } = await db.from('portal_notices')
        .update({ deleted_at: now.toISOString() })
        .neq('id', newNotice.id)
        .is('deleted_at', null);
      if (retireError) console.error('Could not retire older portal notices', retireError.message);
      return NextResponse.json({ ok: true, notice: newNotice }, { headers: { 'Cache-Control': 'no-store' } });
    }
    case 'clear_notice': {
      const { error } = await db.from('portal_notices')
        .update({ deleted_at: new Date().toISOString() })
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: 'تعذر مسح التبليغ. تأكد من إعداد الجدول.' }, { status: 500 });
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    case 'sign_admin_upload': {
      // Explicitly authenticated with ADMIN_PIN above; never expose service role to the browser.
      const ext = String(body.filename || '').split('.').pop()?.toLowerCase() || '';
      const size = Number(body.size);
      if (!Object.hasOwn(EXT_MIME, ext) || !Number.isFinite(size) || size <= 0 || size > 30 * 1024 * 1024) {
        return NextResponse.json({ error: 'صيغة أو حجم الملف غير مسموح' }, { status: 400 });
      }
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from('materials').createSignedUploadUrl(path);
      if (error || !data) return NextResponse.json({ error: 'تعذر تجهيز رابط الرفع' }, { status: 500 });
      return NextResponse.json({ path, token: data.token }, { headers: { 'Cache-Control': 'no-store' } });
    }
    case 'create_admin_item': {
      const course = COURSES.find((c) => c.slug === body.slug);
      const track = course?.split ? body.track : 'main';
      const category = body.category === 'exams_plus' && body.slug === 'biomedical-sensors' ? 'quizzes' : body.category;
      const available = ['lectures', 'reports', 'quizzes', 'midterms', 'finals', 'summaries', 'videos'];
      const title = String(body.title ?? '').trim();
      const fileEntries = Array.isArray(body.files) ? body.files : [];
      const video = category === 'videos';
      const description = String(body.description ?? '').trim().slice(0, 5000);
      if (!course || !['main', 'theory', 'lab'].includes(track) || (course.split && track === 'main') ||
          !available.includes(category) || (track === 'lab' && video) || (track !== 'lab' && category === 'reports') ||
          title.length < 2 || title.length > 200 || fileEntries.length > 10 ||
          (video && (fileEntries.length || !/^https:\/\//i.test(String(body.url || '')))) ||
          (!video && !fileEntries.length && !(description && ['quizzes', 'midterms', 'finals'].includes(category)))) {
        return NextResponse.json({ error: 'بيانات النشر غير صحيحة' }, { status: 400 });
      }
      // Accept only server-minted upload paths; reject arbitrary Storage URLs.
      const files: {path: string;kind: string;name: string}[] = [];
      for (const entry of fileEntries) {
        const path = String(entry?.path || '');
        const ext = path.split('.').pop()?.toLowerCase() || '';
        if (!/^uploads\/[a-f0-9-]{36}\.(pdf|png|jpg|jpeg|webp|doc|docx|ppt|pptx)$/i.test(path) || !Object.hasOwn(EXT_MIME, ext)) {
          return NextResponse.json({ error: 'مسار ملف غير صالح' }, { status: 400 });
        }
        files.push({ path, kind: kindFromExt(ext), name: String(entry?.name || '').slice(0, 200) });
      }
      const { data: created, error } = await db.from('items').insert({
        subject_slug: course.slug, track, category, title,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.trim().slice(0, 50)).slice(0, 8) : [],
        file_path: files[0]?.path || null, file_kind: video ? 'video' : files[0]?.kind || 'text',
        attachments: files.slice(1), external_url: video ? String(body.url).trim() : null,
        uploader_name: 'المشرف', description: description || null,
        status: 'approved', badges: [],
      }).select('id').single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'تعذر نشر الملف' }, { status: 500 });
      return NextResponse.json({ ok: true, id: created.id }, { headers: { 'Cache-Control': 'no-store' } });
    }
    case 'rename_item': {
      const title = String(body.title || '').trim();
      if (title.length < 2 || title.length > 200) {
        return NextResponse.json({ error: 'العنوان لازم يكون بين حرفين و200 حرف' }, { status: 400 });
      }
      const { data: current, error: readError } = await db.from('items')
        .select('attachments').eq('id', id).eq('status', 'approved').maybeSingle();
      if (readError || !current) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
      const existing = (current.attachments as { path: string; kind: string; name?: string }[] | null) || [];
      const proposed = Array.isArray(body.attachmentNames) ? body.attachmentNames : [];
      const names = new Map<string, string>();
      if (proposed.length > 10) return NextResponse.json({ error: 'عدد الملفات غير صحيح' }, { status: 400 });
      for (const entry of proposed) {
        const filePath = String(entry?.path || '');
        const name = String(entry?.name || '').trim();
        if (name.length < 2 || name.length > 200 || !existing.some((a) => a.path === filePath)) {
          return NextResponse.json({ error: 'اسم أحد الملفات غير صحيح' }, { status: 400 });
        }
        names.set(filePath, name);
      }
      // Preserve real Storage paths and file kinds; changing a visible name never moves bytes.
      const attachments = existing.map((a) => ({ ...a, name: names.get(a.path) ?? a.name }));
      const { data, error } = await db.from('items').update({ title, attachments }).eq('id', id).eq('status', 'approved').select('id').maybeSingle();
      if (error || !data) return NextResponse.json({ error: 'تعذر تعديل اسم الملف' }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case 'prepare_old_quiz': {
      // One manual Preview-only recovery attempt for an existing approved PDF.
      // ADMIN_PIN is checked above. Never restart a ready, active or cooling-down bank.
      if (process.env.VERCEL_ENV === 'production') {
        return NextResponse.json({ error: 'هذا الاختبار متاح في Preview فقط؛ Production يستخدم الفحص المجدول.' }, { status: 403 });
      }
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'مفتاح Gemini غير مضبوط في Preview.' }, { status: 503 });
      }
      const day = new Date().toISOString().slice(0, 10);
      const attempts = await db.from('quiz_banks')
        .select('id', { count: 'exact', head: true }).gte('created_at', `${day}T00:00:00.000Z`);
      if (attempts.error) return NextResponse.json({ error: 'تعذّر قراءة حدّ المحاولات اليومية.' }, { status: 503 });
      if ((attempts.count || 0) >= 4) {
        return NextResponse.json({ error: 'وصلنا حد التجارب اليومي (4). ننتظر لليوم التالي حتى نحافظ على الحصة المجانية.' }, { status: 429 });
      }
      const itemsQuery = await db.from('items')
        .select('id, file_path, file_kind, attachments')
        .eq('status', 'approved').eq('category', 'lectures')
        .order('created_at', { ascending: true }).limit(1000);
      if (itemsQuery.error) return NextResponse.json({ error: 'تعذّر قراءة الملازم المنشورة.' }, { status: 503 });
      const bankQuery = await db.from('quiz_banks')
        .select('item_id,file_path,status,updated_at').limit(5000);
      if (bankQuery.error) return NextResponse.json({ error: 'تعذّر قراءة بنوك الأسئلة.' }, { status: 503 });
      const known = new Map((bankQuery.data || []).map((b) => [`${b.item_id}:${b.file_path}`, b]));
      for (const item of itemsQuery.data || []) {
        const files: {path:string;kind:string}[] = [
          ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind }] : []),
          ...((item.attachments as {path:string;kind:string}[] | null) || []),
        ];
        for (const file of files) {
          if (file.kind !== 'pdf' || !file.path?.startsWith('uploads/')) continue;
          const bank = known.get(`${item.id}:${file.path}`);
          if (bank?.status === 'ready') continue;
          const elapsed = Date.now() - new Date(bank?.updated_at || 0).getTime();
          if (bank?.status === 'generating' && elapsed < 10 * 60_000) continue;
          if (bank?.status === 'failed' && elapsed < 24 * 60 * 60_000) continue;
          const result = await generateQuiz(item.id, file.path);
          return NextResponse.json({
            status: result.status,
            message: result.status === 'ready' ? 'تم تجهيز أسئلة ملزمة قديمة وحفظها بنجاح.'
              : result.status === 'busy' ? 'الملزمة قيد المعالجة أو محفوظة سابقاً.'
              : result.error || 'تعذّر تجهيز الملزمة، ويمكن المحاولة لاحقاً.',
          }, { headers: { 'Cache-Control': 'no-store' } });
        }
      }
      return NextResponse.json({ status: 'empty', message: 'لا توجد ملازم قديمة جاهزة للتوليد حالياً، أو أن المتبقي في فترة انتظار.' });
    }
    case 'list': {
      const pending = await db.from('items').select('*').eq('status', 'pending').order('created_at');
      const reports = await db.from('reports')
        .select('id, reason, created_at, items(id, title, subject_slug, track, file_path, external_url)')
        .eq('resolved', false).order('created_at');
      const approved = await db.from('items')
        .select('id, title, subject_slug, track, category, file_path, external_url, created_at, exam_pick, description, file_kind, attachments')
        .eq('status', 'approved').order('created_at', { ascending: true }).limit(500);
      const { data: notice } = await db.from('portal_notices')
        .select('id, message, expires_at')
        .is('deleted_at', null).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      return NextResponse.json({ pending: pending.data || [], reports: reports.data || [], approved: approved.data || [], notice: notice || null, previewOnly: process.env.VERCEL_ENV !== 'production' });
    }
    case 'approve': {
      const badges = (Array.isArray(body.badges) ? body.badges : []).filter((b: string) => BADGES.includes(b));
      const { error } = await db.from('items').update({ status: 'approved', badges }).eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    case 'reject': {
      await removeFile(id);
      const { error } = await db.from('items').update({ status: 'rejected' }).eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    case 'remove_item': { // delete a reported (already published) item entirely
      await removeFile(id);
      const { error } = await db.from('items').delete().eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    case 'toggle_pick': { // include / exclude an item from Exam Night mode
      const { error } = await db.from('items').update({ exam_pick: Boolean(body.value) }).eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    case 'move_item': { // move a published item to another course / track / category
      const c = COURSES.find((x) => x.slug === body.slug);
      const cats = ['lectures', 'reports', 'quizzes', 'midterms', 'finals', 'summaries', 'videos'];
      const category = body.slug === 'biomedical-sensors' && body.category === 'exams_plus' ? 'quizzes' : body.category;
      const track = c?.split ? body.track : 'main';
      if (!c || !['theory', 'lab', 'main'].includes(track) || (c.split && track === 'main') || !cats.includes(category)) {
        return NextResponse.json({ error: 'وجهة النقل غير صالحة' }, { status: 400 });
      }
      if ((track === 'lab' && category === 'videos') || (track !== 'lab' && body.category === 'reports')) {
        return NextResponse.json({ error: 'هذا القسم غير متاح لهذا المسار (التقارير للمختبر فقط، والشروحات للنظري فقط).' }, { status: 400 });
      }
      const { data: it } = await db.from('items').select('file_path, file_kind').eq('id', id).single();
      if (it?.file_kind === 'text') {
        if (!['quizzes', 'midterms', 'finals'].includes(category)) {
          return NextResponse.json({ error: 'النصوص تُنقل للكوزات أو المدات أو الفاينلات فقط.' }, { status: 400 });
        }
      } else if (!it?.file_path !== (category === 'videos')) {
        return NextResponse.json({ error: 'الروابط تُنقل لقسم الشروحات فقط، والملفات لباقي الأقسام.' }, { status: 400 });
      }
      const upd: Record<string, unknown> = { subject_slug: c.slug, track, category };
      if (typeof body.description === 'string') upd.description = body.description.trim().slice(0, 5000) || null;
      const { error } = await db.from('items').update(upd).eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    case 'resolve_report': {
      const { error } = await db.from('reports').update({ resolved: true }).eq('id', id);
      return NextResponse.json({ ok: !error, error: error?.message });
    }
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
