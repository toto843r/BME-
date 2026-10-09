'use client';
import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ChevronLeft, RotateCcw } from 'lucide-react';
import type { QuizBank } from '@/lib/quiz';

type Section = keyof QuizBank;
type AnswerValue = string | number | boolean;
const groups: { key: Section; title: string; short: string }[] = [
  { key: 'mcq', title: 'Multiple Choice Questions', short: 'MCQ' },
  { key: 'blanks', title: 'Fill in the Blanks', short: 'الفراغات' },
  { key: 'trueFalse', title: 'True / False', short: 'صح / خطأ' },
  { key: 'definitions', title: 'Definitions', short: 'التعاريف' },
  { key: 'reasons', title: 'Give Reasons', short: 'التعاليل' },
  { key: 'diagrams', title: 'Diagram Questions', short: 'الرسومات' },
];
function keyFor(section: string, i: number) { return `${section}-${i}`; }
export default function QuizClient({ id, file }: { id: string; file: string }) {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<Section>('mcq');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endpoint = `/api/quiz/${encodeURIComponent(id)}?file=${encodeURIComponent(file)}`;
  const progressKey = `bme-quiz-progress-v1-${id}-${file}`;
  const bankKey = `bme-quiz-bank-v1-${id}-${file}`;
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(bankKey) || 'null');
      if (cached?.mcq?.length === 10) { setBank(cached); setStatus('ready'); }
    } catch { /* bank not yet cached */ }
  }, [bankKey]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || '{}');
      if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers);
    } catch { /* private session */ }
  }, [progressKey]);
  useEffect(() => {
    try { localStorage.setItem(progressKey, JSON.stringify({ answers })); } catch {}
  }, [answers, progressKey]);

  useEffect(() => {
    if (!file) { setMessage('لا يوجد ملف PDF محدد.'); setStatus('failed'); return; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let polls = 0;
    const load = async () => {
      if (stopped) return;
      try {
        const r = await fetch(endpoint, { cache: 'no-store' });
        const data = await r.json();
        if (stopped) return;
        if (data.status === 'ready' && data.questions) { setBank(data.questions); setStatus('ready'); try { localStorage.setItem(bankKey, JSON.stringify(data.questions)); } catch {} return; }
        if (data.status === 'unconfigured' || r.status === 404) {
          setStatus('failed'); setMessage(data.error || 'الاختبار غير متاح.'); return;
        }
        if (data.status === 'failed') {
          setStatus('failed'); setMessage(data.error || 'تعذر إنشاء الاختبار حالياً.'); return;
        }
        setStatus('generating');
        // A single client starts the generation, all others only poll existing state.
        if (!started && data.status === 'pending') {
          started = true;
          void fetch(endpoint, { method: 'POST' }).then(async (result) => {
            if (!result.ok && result.status !== 202 && !stopped) {
              const j = await result.json().catch(() => ({}));
              if (j.status === 'unconfigured') { setStatus('failed'); setMessage(j.error || 'لم يُجهز نظام الأسئلة بعد.'); stopped = true; }
            }
          }).catch(() => {});
        }
        if (++polls < 36) timer = setTimeout(load, 5000);
        else { setStatus('waiting'); setMessage('تجهيز الأسئلة يستغرق وقتاً أطول من المعتاد. أعد فتح الاختبار لاحقاً.'); }
      } catch {
        if (stopped) return;
        setStatus('failed'); setMessage('تعذر الاتصال. افتح الاختبار مرة بعد توفر الإنترنت، ثم ستتوفر نسخته المحفوظة.');
      }
    };
    void load();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [endpoint, attempt, file, bankKey]);

  const score = useMemo(() => {
    if (!bank) return { correct: 0, total: 0, answered: 0 };
    let correct = 0, answered = 0;
    const auto: Section[] = ['mcq', 'blanks', 'trueFalse'];
    for (const s of auto) bank[s].forEach((q: any, i: number) => {
      const a = answers[keyFor(s, i)];
      if (a === undefined || a === '') return;
      answered++;
      if (s === 'blanks' ? String(a).trim().replace(/\s+/g, ' ').toLowerCase() === String(q.answer).trim().replace(/\s+/g, ' ').toLowerCase() : a === q.answer) correct++;
    });
    return { correct, answered, total: 25 };
  }, [answers, bank]);
  const set = (s: Section, i: number, answer: AnswerValue) => {
    setAnswers((previous) => ({ ...previous, [keyFor(s, i)]: answer }));
  };
  if (status !== 'ready' || !bank) {
    return <div className="space-y-3 rounded-xl border border-line bg-panel p-6 text-center" role="status">
      <BookOpenCheck size={32} className="mx-auto text-brand" />
      <p className="font-bold">{status === 'generating' ? 'جارٍ تحضير بنك الأسئلة للمرة الأولى…' : status === 'waiting' ? 'الأسئلة قيد التحضير' : 'الأسئلة غير جاهزة بعد'}</p>
      <p className="text-sm text-muted">{message || 'سيُحفظ بنك الأسئلة بعد توليده مرة واحدة، وتستخدمه بقية الطلبة دون توليد إضافي. لا تتطلب زيارة الاختبار تحميل ملف PDF.'}</p>
      {(status === 'failed' || status === 'waiting') && <button onClick={() => { setMessage(''); setStatus('pending'); setAttempt((v) => v + 1); }} className="rounded-lg border border-line px-4 py-2 text-sm">تحقق مجدداً</button>}
    </div>;
  }
  const questions = bank[section];
  const currentIndex = groups.findIndex((g) => g.key === section);
  return <div className="space-y-4">
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3"><span className="font-semibold">تقدّم الاختبار</span><span className="text-sm text-muted">{score.answered}/{score.total} سؤال موضوعي</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${100 * score.answered / score.total}%` }} /></div>
      {showAnswers && <p className="mt-2 font-bold text-brand">نتيجة الأسئلة الموضوعية: {score.correct} / {score.total} (الأسئلة المقالية للمراجعة الذاتية)</p>}
    </div>
    <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="أنواع الأسئلة">
      {groups.filter((g) => bank[g.key].length).map((g) => <button key={g.key} role="tab" aria-selected={section === g.key} onClick={() => setSection(g.key)}
        className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${section === g.key ? 'border-brand bg-brand text-onbrand' : 'border-line bg-panel text-muted'}`}>{g.short} ({bank[g.key].length})</button>)}
    </div>
    <h2 className="text-lg font-bold" dir="auto">{groups.find((g) => g.key === section)?.title}</h2>
    <div className="space-y-3">
      {questions.map((q: any, i: number) => {
        const answer = answers[keyFor(section, i)];
        const isMcq = section === 'mcq';
        const isTF = section === 'trueFalse';
        const isBlank = section === 'blanks';
        return <article key={`${section}-${i}`} className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-start gap-2"><span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 text-sm font-semibold text-brand">{i + 1}</span><p dir="auto" className="min-w-0 flex-1 whitespace-pre-wrap font-medium leading-relaxed">{q.question}</p></div>
          {typeof q.page === 'number' && <p className="mt-1 text-end text-xs text-muted">Page {q.page}</p>}
          {isMcq && <div className="mt-3 space-y-2" dir="auto">
            {(q.options as string[]).map((option, oi) => <label key={oi} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${answer === oi ? 'border-brand bg-brand/10' : 'border-line hover:bg-line/30'}`}>
              <input type="radio" name={`${section}-${i}`} checked={answer === oi} onChange={() => set(section, i, oi)} className="accent-brand" /><span className="min-w-0 flex-1">{option}</span>
            </label>)}
          </div>}
          {isTF && <div className="mt-3 flex gap-2">{([{value:true,label:'True / صح'},{value:false,label:'False / خطأ'}] as const).map((option) => <button key={String(option.value)} onClick={() => set(section, i, option.value)}
            className={`rounded-lg border px-4 py-2 text-sm ${answer === option.value ? 'border-brand bg-brand/10 text-brand' : 'border-line'}`}>{option.label}</button>)}</div>}
          {isBlank && <input dir="auto" type="text" value={typeof answer === 'string' ? answer : ''} onChange={(e) => set(section, i, e.target.value)} placeholder="اكتب الإجابة" className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-brand" />}
          {!isMcq && !isTF && !isBlank && <textarea dir="auto" value={typeof answer === 'string' ? answer : ''} onChange={(e) => set(section, i, e.target.value)} rows={3} placeholder="دوّن إجابتك قبل عرض النموذجية" className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-brand" />}
          {showAnswers && <div className="mt-3 space-y-1 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm" dir="auto">
            <p className="flex items-center gap-2 font-semibold text-brand"><CheckCircle2 size={15} /> الإجابة النموذجية</p>
            <p className="whitespace-pre-wrap">{isMcq ? `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}` : isTF ? q.answer ? 'True' : 'False' : q.answer}</p>
            {q.explanation && <p className="text-muted">{q.explanation}</p>}
          </div>}
        </article>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setShowAnswers((v) => !v)} className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand">{showAnswers ? 'إخفاء الحلول' : 'تحقق من الإجابات وعرض الحلول'}</button>
      {currentIndex < groups.length - 1 && <button onClick={() => { const next = groups.slice(currentIndex + 1).find((g) => bank[g.key].length); if (next) setSection(next.key); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm">القسم التالي <ChevronLeft size={15}/></button>}
      <button onClick={() => { if (window.confirm('مسح جميع إجاباتك والبدء مجدداً؟')) { setAnswers({}); setShowAnswers(false); setSection('mcq'); } }} className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm"><RotateCcw size={15} /> إعادة الاختبار</button>
    </div>
    <p className="text-xs text-muted">التصحيح التلقائي للفراغات يعتمد على تطابق النص بعد تجاهل اختلاف الحروف والمسافات؛ راجع الحل النموذجي عند وجود صياغة بديلة صحيحة. الأسئلة المقالية والرسومات لا تُقيّم آلياً.</p>
  </div>;
}
