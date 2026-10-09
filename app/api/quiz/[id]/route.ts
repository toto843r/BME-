import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const noStore = { 'Cache-Control': 'no-store, private' };
const isUuid = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

async function validLecture(id: string, file: string) {
  if (!isUuid(id) || !file.startsWith('uploads/') || file.length > 500) return false;
  const db = supabaseAdmin();
  const { data: item } = await db.from('items').select('category,file_path,file_kind,attachments')
    .eq('id', id).eq('status', 'approved').maybeSingle();
  if (!item || item.category !== 'lectures') return false;
  const files = [
    ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind }] : []),
    ...((item.attachments as { path: string; kind: string }[] | null) || []),
  ];
  return files.some((f) => f.path === file && f.kind === 'pdf');
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = new URL(request.url).searchParams.get('file') || '';
    if (!(await validLecture(id, file))) return response({ error: 'هذه الملزمة غير متاحة.' }, 404);
    const { data, error } = await supabaseAdmin().from('quiz_banks')
      .select('status,questions,updated_at').eq('item_id', id).eq('file_path', file).maybeSingle();
    if (error) return response({ status: 'unconfigured', error: 'لم يُضبط بنك الأسئلة.' }, 503);
    const elapsed = Date.now() - new Date(data?.updated_at || 0).getTime();
    const retryable = (data?.status === 'generating' && elapsed > 10 * 60_000) ||
      (data?.status === 'failed' && elapsed > 24 * 60 * 60_000);
    return response(data?.status === 'ready'
      ? { status: 'ready', questions: data.questions }
      : { status: retryable ? 'pending' : data?.status || 'pending', error: data?.status === 'failed' && !retryable ? 'تعذّر تجهيز بنك الأسئلة وسيعيد النظام المحاولة تلقائياً لاحقاً.' : undefined });
  } catch { return response({ error: 'تعذّر قراءة بنك الأسئلة.' }, 503); }
}
