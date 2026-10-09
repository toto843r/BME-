import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQuiz } from '@/lib/quizGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Vercel Cron runs in Production only; it recovers uploads interrupted before their banks were ready.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const authorization = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Gemini Free Tier not configured; no generation started.' }, { status: 503 });

  const db = supabaseAdmin();
  const { data: items, error } = await db.from('items').select('id,file_path,file_kind,attachments')
    .in('status', ['pending', 'approved']).eq('category', 'lectures').order('created_at', { ascending: true }).limit(1000);
  if (error) return NextResponse.json({ error: 'Could not read approved lectures.' }, { status: 503 });
  const { data: banks, error: bankError } = await db.from('quiz_banks')
    .select('item_id,file_path,status,updated_at').limit(5000);
  if (bankError) return NextResponse.json({ error: 'Could not read banks.' }, { status: 503 });
  const known = new Map((banks || []).map((b) => [`${b.item_id}:${b.file_path}`, b]));
  let generated = 0, waiting = 0, failed = 0;
  const deadline = Date.now() + 240_000;
  // Cap AI operations so the daily Free Tier is not accidentally exhausted by a large backlog.
  outer: for (const item of items || []) {
    const files = [
      ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind }] : []),
      ...((item.attachments as { path: string; kind: string }[] | null) || []),
    ];
    for (const file of files) {
      if (file.kind !== 'pdf' || !file.path?.startsWith('uploads/')) continue;
      const bank = known.get(`${item.id}:${file.path}`);
      if (bank?.status === 'ready') continue;
      const elapsed = Date.now() - new Date(bank?.updated_at || 0).getTime();
      if (bank?.status === 'generating' && elapsed < 10 * 60_000) { waiting++; continue; }
      if (bank?.status === 'failed' && elapsed < 24 * 60 * 60_000) { waiting++; continue; }
      if (Date.now() >= deadline || generated + failed >= 4) break outer;
      const result = await generateQuiz(item.id, file.path);
      if (result.status === 'ready') generated++;
      else if (result.status === 'failed' || result.status === 'unconfigured') { failed++; if (result.status === 'unconfigured') break outer; }
      else waiting++;
    }
  }
  return NextResponse.json({ generated, failed, waiting, note: 'Daily upload backfill checked.' }, { headers: { 'Cache-Control': 'no-store' } });
}
