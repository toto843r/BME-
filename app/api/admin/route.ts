import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { COURSES } from '@/lib/courses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const { data } = await db.from('items').select('file_path').eq('id', itemId).single();
    if (data?.file_path) await db.storage.from('materials').remove([data.file_path]);
  }

  switch (body.action) {
    case 'list': {
      const pending = await db.from('items').select('*').eq('status', 'pending').order('created_at');
      const reports = await db.from('reports')
        .select('id, reason, created_at, items(id, title, subject_slug, track, file_path, external_url)')
        .eq('resolved', false).order('created_at');
      const approved = await db.from('items')
        .select('id, title, subject_slug, track, category, file_path, external_url, created_at, exam_pick, description')
        .eq('status', 'approved').order('created_at', { ascending: false }).limit(500);
      return NextResponse.json({ pending: pending.data || [], reports: reports.data || [], approved: approved.data || [] });
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
      const track = c?.split ? body.track : 'main';
      if (!c || !['theory', 'lab', 'main'].includes(track) || (c.split && track === 'main') || !cats.includes(body.category)) {
        return NextResponse.json({ error: 'وجهة النقل غير صالحة' }, { status: 400 });
      }
      if ((track === 'lab' && body.category === 'videos') || (track !== 'lab' && body.category === 'reports')) {
        return NextResponse.json({ error: 'هذا القسم غير متاح لهذا المسار (التقارير للمختبر فقط، والشروحات للنظري فقط).' }, { status: 400 });
      }
      const { data: it } = await db.from('items').select('file_path').eq('id', id).single();
      const isLink = !it?.file_path;
      if (isLink !== (body.category === 'videos')) {
        return NextResponse.json({ error: 'الروابط تُنقل لقسم الشروحات فقط، والملفات لباقي الأقسام.' }, { status: 400 });
      }
      const upd: Record<string, unknown> = { subject_slug: c.slug, track, category: body.category };
      if (typeof body.description === 'string') upd.description = body.description.trim().slice(0, 500) || null;
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
