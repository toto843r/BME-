import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validBank } from '@/lib/quiz';
import type { QuizBank } from '@/lib/quiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const noStore = { 'Cache-Control': 'no-store, private' };
const isUuid = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

async function lookup(id: string, filePath: string) {
  if (!isUuid(id) || !filePath || filePath.length > 500 || !filePath.startsWith('uploads/')) return null;
  const db = supabaseAdmin();
  const { data: item, error } = await db.from('items').select('id,title,category,file_path,file_kind,attachments,status').eq('id', id).eq('status', 'approved').single();
  if (error || !item || item.category !== 'lectures') return null;
  const files = [
    ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind }] : []),
    ...((item.attachments as {path:string;kind:string}[] | null) || []),
  ];
  if (!files.some((f) => f.path === filePath && f.kind === 'pdf')) return null;
  return { db, item };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const file = new URL(request.url).searchParams.get('file') || '';
    const ctx = await lookup(params.id, file);
    if (!ctx) return response({ error: 'هذه الملزمة غير متاحة.' }, 404);
    const { data, error } = await ctx.db.from('quiz_banks').select('status,questions,error_message,updated_at')
      .eq('item_id', params.id).eq('file_path', file).maybeSingle();
    if (error) return response({ status: 'unconfigured', error: 'يلزم تنفيذ supabase/quiz_banks.sql أولاً.' }, 503);
    // A stale in-progress job or past cooldown is eligible for a new atomic claim.
    const elapsed = Date.now() - new Date(data?.updated_at || 0).getTime();
    const retry = (data?.status === 'generating' && elapsed > 10 * 60_000) ||
      (data?.status === 'failed' && elapsed > 24 * 60 * 60_000);
    return response(data?.status === 'ready' ? { status: 'ready', questions: data.questions } :
      { status: retry ? 'pending' : data?.status || 'pending', error: data?.status === 'failed' && !retry ? 'تعذر توليد الأسئلة حالياً. سيعاد المحاولة بعد 24 ساعة ضمن الحصة المجانية.' : undefined });
  } catch { return response({ error: 'تعذر قراءة بنك الأسئلة.' }, 503); }
}

const prompt = `You are a precise university teaching assistant. Read the ATTACHED PDF including its equations, tables and diagrams. Generate an exam based ONLY on its content. Difficulty: 70% moderate and 30% slightly challenging. No excessively tricky, vague or memorization-only questions. Preserve the PDF's academic language (English if English). Generate EXACTLY:
- mcq: 10 objects {question, options (exactly 4), answer (zero-based correct index 0..3), explanation, page if reliable}.
- blanks: 10 objects {question with one explicit "_____" blank, answer, explanation, page if reliable}.
- trueFalse: 5 objects {question, answer (boolean), explanation, page if reliable}.
- definitions: 5 objects {question, answer, page if reliable}.
- reasons: 5 objects {question, answer, page if reliable}.
- diagrams: 1 or 2 objects {question, answer, page}. Ask to label, explain or redraw only a DIAGRAM THAT REALLY EXISTS in the PDF, with page reference; if no meaningful diagrams, return [].
Use proper terminology, distinguish plausible concepts fairly, avoid repetition, include reliable sample answers. Do NOT invent page numbers, diagrams, claims, facts or content from outside the PDF. Every answer must be correct and grounded. Return ONLY one valid JSON object with EXACTLY those six array keys and no markdown.`;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let ctx: Awaited<ReturnType<typeof lookup>>;
  let file = '';
  try {
    file = new URL(request.url).searchParams.get('file') || '';
    ctx = await lookup(params.id, file);
  } catch { return response({ error: 'فشل الاتصال بقاعدة البيانات.' }, 503); }
  if (!ctx) return response({ error: 'الملزمة غير موجودة.' }, 404);
  if (!process.env.GEMINI_API_KEY) return response({ status: 'unconfigured', error: 'أضف GEMINI_API_KEY في Vercel لتفعيل توليد الأسئلة المجاني.' }, 503);
  const { data: locked, error: lockError } = await ctx.db.rpc('claim_quiz_generation', { p_item_id: params.id, p_file_path: file });
  if (lockError) return response({ status: 'unconfigured', error: 'يلزم تشغيل supabase/quiz_banks.sql.' }, 503);
  if (!locked) return response({ status: 'generating_or_ready', message: 'البنك موجود أو قيد التجهيز أو ينتظر إعادة المحاولة.' }, 202);
  const fail = async (message: string) => {
    await ctx!.db.from('quiz_banks').update({ status: 'failed', error_message: message.slice(0, 250), updated_at: new Date().toISOString() })
      .eq('item_id', params.id).eq('file_path', file);
    return response({ status: 'failed', error: 'تعذر توليد الأسئلة الآن؛ سيُتاح تكرار المحاولة لاحقاً دون رسوم.' }, 503);
  };
  try {
    // Storage API verifies file path; never fetch arbitrary user-supplied URLs.
    const { data: downloaded, error } = await ctx.db.storage.from('materials').download(file);
    if (error || !downloaded) return await fail('Storage download failed');
    if (downloaded.size > 30 * 1024 * 1024) return await fail('PDF exceeds 30 MiB safety limit');
    const pdf = Buffer.from(await downloaded.arrayBuffer());
    if (pdf.subarray(0, 5).toString() !== '%PDF-') return await fail('File is not a PDF');
    const hash = createHash('sha256').update(pdf).digest('hex');
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    // Gemini REST; no npm AI dependencies and no billing fallback.
    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({ contents: [{ parts: [
        { text: prompt }, { inline_data: { mime_type: 'application/pdf', data: pdf.toString('base64') } },
      ] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 16384 } }),
      signal: AbortSignal.timeout(90000),
    });
    if (!ai.ok) return await fail(`Gemini request ${ai.status}: ${String(await ai.text()).slice(0, 180)}`);
    const raw = await ai.json();
    const answer = raw?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
    let parsed: QuizBank;
    try { parsed = JSON.parse(answer); } catch { return await fail('AI returned malformed JSON'); }
    if (!validBank(parsed)) return await fail('Incomplete / invalid exam structure');
    const { error: saveError } = await ctx.db.from('quiz_banks').update({ status: 'ready', questions: parsed, content_hash: hash,
      error_message: null, updated_at: new Date().toISOString() }).eq('item_id', params.id).eq('file_path', file);
    if (saveError) return await fail('Database save failed');
    return response({ status: 'ready', questions: parsed });
  } catch (error: unknown) {
    console.error('Quiz generation failed:', error instanceof Error ? error.message : 'unknown');
    return await fail('Unexpected generator failure');
  }
}
