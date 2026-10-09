import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { COURSES } from '@/lib/courses';
import { generateQuiz } from '@/lib/quizGenerator';

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
        .select('id, title, subject_slug, track, category, file_path, external_url, created_at, exam_pick, description, file_kind')
        .eq('status', 'approved').order('created_at', { ascending: true }).limit(500);
      return NextResponse.json({ pending: pending.data || [], reports: reports.data || [], approved: approved.data || [], previewOnly: process.env.VERCEL_ENV !== 'production' });
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
