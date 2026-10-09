import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQuiz } from '@/lib/quizGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const noStore = { 'Cache-Control': 'no-store' };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const respond = (obj: unknown, status = 200) => NextResponse.json(obj, { status, headers: noStore });

// Invoked once on successful upload. Public uploads are untrusted: verify the
// just-created pending row on the server, never accept arbitrary file paths,
// and limit how many requests can consume the free AI quota in a day.
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return respond({ error: 'Forbidden' }, 403);
    } catch { return respond({ error: 'Forbidden' }, 403); }
  }
  let body: { itemId?: string };
  try { body = await req.json(); } catch { return respond({ error: 'Invalid request' }, 400); }
  const itemId = String(body.itemId || '');
  if (!isUuid(itemId)) return respond({ error: 'Invalid item' }, 400);
  if (!process.env.GEMINI_API_KEY) return respond({ status: 'unconfigured' }, 503);

  const db = supabaseAdmin();
  const { data: item, error } = await db.from('items')
    .select('id,status,category,created_at,file_path,file_kind,attachments')
    .eq('id', itemId).eq('status', 'pending').eq('category', 'lectures').maybeSingle();
  if (error || !item || Date.now() - new Date(item.created_at).getTime() > 5 * 60_000) {
    return respond({ error: 'Upload not eligible' }, 404);
  }
  const pdfPaths = [
    ...(item.file_path && item.file_kind === 'pdf' ? [item.file_path] : []),
    ...((item.attachments as { path: string; kind: string }[] | null) || [])
      .filter((file) => file.kind === 'pdf').map((file) => file.path),
  ].filter((path: string) => path.startsWith('uploads/'));
  if (!pdfPaths.length) return respond({ status: 'skipped' });

  // Soft daily guard, in addition to Gemini's hard no-billing Free Tier quotas.
  // Bank locking is atomic per PDF. Concurrent uploads can exceed this soft
  // guard slightly, but cannot enable billing or generate the same bank twice.
  const day = new Date().toISOString().slice(0, 10);
  const { count, error: countError } = await db.from('quiz_banks')
    .select('id', { head: true, count: 'exact' })
    .gte('created_at', `${day}T00:00:00.000Z`);
  if (countError) return respond({ status: 'pending', note: 'Backfill will retry' }, 202);
  if ((count || 0) >= 4) return respond({ status: 'pending', note: 'Daily free generation cap reached' }, 202);

  let processed = 0;
  for (const path of pdfPaths) {
    // Other files from this upload are recovered by the scheduled worker.
    if (processed >= Math.max(1, 4 - (count || 0))) break;
    const generated = await generateQuiz(itemId, path);
    if (generated.status === 'ready' || generated.status === 'failed') processed++;
  }
  return respond({ status: 'queued', processed }, 202);
}
