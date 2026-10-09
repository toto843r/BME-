import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validBank } from '@/lib/quiz';
import type { QuizBank } from '@/lib/quiz';

const isUuid = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

type Outcome = { status: 'ready' | 'busy' | 'failed' | 'unconfigured' | 'not_found'; error?: string; questions?: QuizBank };

// Shared question instructions for automatic upload and recovery jobs.
const prompt = `You are an accurate university examiner preparing revision questions from the ATTACHED lecture PDF only. Read its text, equations, tables and diagrams. Use the PDF's original academic language (English for English lectures).

LEVEL: Moderate to slightly challenging, approximately 70% moderate and 30% a little more demanding. A student who thoroughly understands the lecture should be able to answer fairly. Do NOT use obscure facts, misleading wording, trick choices, or knowledge not given in the lecture.
QUALITY: Avoid merely repeating a heading or asking the simplest definition as an MCQ when the lecture supports a meaningful conceptual question. Prefer understanding, comparing two taught concepts, interpreting a described mechanism, recognizing an implication of a taught equation, or applying an example explicitly in the PDF. At least six of the ten MCQs should test comprehension beyond verbatim recall; the remaining can assess important precise details. Distractors should be plausible but clearly distinguishable from the lecture. Do not create artificially difficult calculations. Cover different important topics and avoid repetition. Definitions should still be answerable in normal academic terms.

Return EXACTLY one JSON object with these keys:
- mcq: 10 {question, options (array of exactly 4), answer (zero-based correct index 0..3), explanation, page if reliable}.
- blanks: 10 {question with exactly one '_____' blank, answer, explanation, page if reliable}; target an important taught relationship or technical term, not a trivial missing word.
- trueFalse: 5 {question, answer (boolean), explanation, page if reliable}; avoid ambiguous absolutes.
- definitions: 5 {question, answer, page if reliable}.
- reasons: 5 {question, answer, page if reliable}; explain why/how based on the lecture.
- diagrams: 1 or 2 {question, answer, page} only for diagrams actually appearing in the PDF, asking to label/explain/redraw; otherwise [] and never invent a page.

Each answer must be supported by this exact PDF. Do not invent page numbers or diagrams. JSON only, no markdown.`;

export async function generateQuiz(itemId: string, filePath: string): Promise<Outcome> {
  if (!isUuid(itemId) || !filePath.startsWith('uploads/') || filePath.length > 500) {
    return { status: 'not_found', error: 'ملف غير صالح.' };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { status: 'unconfigured', error: 'GEMINI_API_KEY غير متوفر في إعدادات هذه البيئة.' };
  }
  const db = supabaseAdmin();
  const { data: item, error: itemError } = await db.from('items')
    .select('id,category,status,file_path,file_kind,attachments')
    .eq('id', itemId).in('status', ['pending', 'approved']).maybeSingle();
  if (itemError || !item || item.category !== 'lectures') return { status: 'not_found' };
  const files = [
    ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind }] : []),
    ...((item.attachments as { path: string; kind: string }[] | null) || []),
  ];
  if (!files.some((f) => f.path === filePath && f.kind === 'pdf')) return { status: 'not_found' };

  // PostgreSQL enforces the one-generation-at-a-time rule across every server instance.
  const { data: claimed, error: lockError } = await db.rpc('claim_quiz_generation', { p_item_id: itemId, p_file_path: filePath });
  if (lockError) return { status: 'unconfigured', error: 'يلزم تنفيذ supabase/quiz_banks.sql.' };
  if (!claimed) return { status: 'busy' }; // ready, generating or cooldown: never call the model twice

  const fail = async (reason: string): Promise<Outcome> => {
    const safeReason = reason.slice(0, 250);
    console.error('Quiz generation:', safeReason);
    await db.from('quiz_banks').update({ status: 'failed', error_message: safeReason, updated_at: new Date().toISOString() })
      .eq('item_id', itemId).eq('file_path', filePath);
    return { status: 'failed', error: 'تعذّر تجهيز الأسئلة حالياً؛ سيعيد النظام المحاولة لاحقاً دون رسوم.' };
  };

  try {
    const { data: download, error: downloadError } = await db.storage.from('materials').download(filePath);
    if (downloadError || !download) return fail('Could not read stored PDF');
    if (download.size > 30 * 1024 * 1024) return fail('PDF over 30 MiB safety limit');
    const pdf = Buffer.from(await download.arrayBuffer());
    if (pdf.subarray(0, 5).toString() !== '%PDF-') return fail('Not PDF data');
    const contentHash = createHash('sha256').update(pdf).digest('hex');
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: pdf.toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 16384 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!ai.ok) return fail(`Gemini returned ${ai.status}: ${String(await ai.text()).slice(0, 160)}`);
    const raw = await ai.json();
    const answer = raw?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    let questions: QuizBank;
    try { questions = JSON.parse(answer); } catch { return fail('AI response is invalid JSON'); }
    if (!validBank(questions)) return fail('AI response has missing or malformed questions');
    const { error: saveError } = await db.from('quiz_banks').update({
      status: 'ready', questions, content_hash: contentHash, error_message: null, updated_at: new Date().toISOString(),
    }).eq('item_id', itemId).eq('file_path', filePath);
    if (saveError) return fail('Could not save bank');
    return { status: 'ready', questions };
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : 'Unexpected generator failure');
  }
}
