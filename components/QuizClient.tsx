'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ChevronLeft, RotateCcw, XCircle } from 'lucide-react';
import { isBlankAnswerCorrect, validBank } from '@/lib/quiz';
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

const correctStyle = 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/20';
const incorrectStyle = 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/20';
const neutralStyle = 'border-line hover:bg-line/30';

function keyFor(section: Section, index: number): string {
  return `${section}-${index}`;
}

export default function QuizClient({ id, file }: { id: string; file: string }) {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<Section>('mcq');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [verifiedBlanks, setVerifiedBlanks] = useState<Record<string, boolean>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [restoredKey, setRestoredKey] = useState('');

  const endpoint = `/api/quiz/${encodeURIComponent(id)}?file=${encodeURIComponent(file)}`;
  const progressKey = `bme-quiz-progress-v1-${id}-${file}`;
  const bankKey = `bme-quiz-bank-v1-${id}-${file}`;

  // Keep progress for each lecture independently. Do not overwrite it with an
  // empty initial state before the browser has restored the saved answers.
  useEffect(() => {
    let saved: Record<string, AnswerValue> = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(progressKey) || 'null');
      if (parsed?.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)) {
        saved = parsed.answers;
      }
    } catch { /* Private browsing, blocked storage or malformed old progress */ }
    setAnswers(saved);
    setVerifiedBlanks({});
    setShowAnswers(false);
    setSection('mcq');
    setRestoredKey(progressKey);
  }, [progressKey]);

  // Debounce localStorage writes so typing in blanks / essay fields does not
  // synchronously serialize the whole answer set on every keystroke.
  useEffect(() => {
    if (restoredKey !== progressKey) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(progressKey, JSON.stringify({ answers })); } catch { /* Storage unavailable */ }
    }, 350);
    return () => clearTimeout(timer);
  }, [answers, progressKey, restoredKey]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activePolls = 0;
    setBank(null);
    setStatus('pending');
    setMessage('');

    // Offline study: use only a complete, locally saved question bank.
    try {
      const cached: unknown = JSON.parse(localStorage.getItem(bankKey) || 'null');
      if (validBank(cached)) {
        setBank(cached);
        setStatus('ready');
      }
    } catch { /* No cached bank */ }

    if (!file) {
      setStatus('failed');
      setMessage('لا يوجد ملف PDF محدد.');
      return;
    }
    if (!navigator.onLine) {
      setStatus((previous) => previous === 'ready' ? previous : 'offline');
      setMessage('لا يوجد اتصال. افتح الاختبار مرة مع الإنترنت لحفظ أسئلته على جهازك.');
      return;
    }

    const load = async () => {
      if (stopped) return;
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        const data = await response.json();
        if (stopped) return;

        if (data.status === 'ready') {
          if (!validBank(data.questions)) {
            setStatus('failed');
            setMessage('بنك الأسئلة المحفوظ غير مكتمل؛ يحتاج مراجعة من الإدارة.');
            return;
          }
          setBank(data.questions);
          setStatus('ready');
          setMessage('');
          try { localStorage.setItem(bankKey, JSON.stringify(data.questions)); } catch { /* Quiz works online */ }
          return;
        }
        if (response.status === 404) {
          // Do not keep showing cached questions for a removed/unpublished PDF.
          setBank(null);
          try { localStorage.removeItem(bankKey); } catch {}
          setStatus('failed');
          setMessage(data.error || 'هذه الملزمة غير متاحة.');
          return;
        }
        if (!response.ok || data.status === 'unconfigured' || data.status === 'failed') {
          setStatus('failed');
          setMessage(data.error || 'تعذر قراءة بنك الأسئلة حالياً.');
          return;
        }

        // A pending bank can wait hours until the next daily job. Polling it
        // dozens of times per student is unnecessary server/database load.
        if (data.status === 'generating' && activePolls < 4) {
          setStatus('generating');
          activePolls++;
          timer = setTimeout(load, 15_000);
        } else {
          setStatus(data.status === 'generating' ? 'waiting' : 'pending');
          setMessage('الملزمة بانتظار التجهيز التلقائي. يمكنك العودة لاحقاً أو التحقق مجدداً.');
        }
      } catch {
        if (stopped) return;
        // Keep an existing offline bank visible even if a refresh request fails.
        setStatus((previous) => previous === 'ready' ? previous : 'offline');
        setMessage('تعذر الاتصال بالخادم. إذا حفظت الأسئلة سابقاً يمكنك إكمال الاختبار دون إنترنت.');
      }
    };
    void load();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [endpoint, attempt, file, bankKey]);

  const score = useMemo(() => {
    if (!bank) return { correct: 0, total: 25, answered: 0 };
    let correct = 0;
    let answered = 0;
    bank.mcq.forEach((q, i) => {
      const answer = answers[keyFor('mcq', i)];
      if (typeof answer !== 'number') return;
      answered++;
      if (answer === q.answer) correct++;
    });
    bank.trueFalse.forEach((q, i) => {
      const answer = answers[keyFor('trueFalse', i)];
      if (typeof answer !== 'boolean') return;
      answered++;
      if (answer === q.answer) correct++;
    });
    bank.blanks.forEach((q, i) => {
      const answer = answers[keyFor('blanks', i)];
      if (typeof answer !== 'string' || !answer.trim()) return;
      answered++;
      if (isBlankAnswerCorrect(answer, q.answer)) correct++;
    });
    return { correct, answered, total: bank.mcq.length + bank.trueFalse.length + bank.blanks.length };
  }, [answers, bank]);

  const setAnswer = (group: Section, index: number, answer: AnswerValue) => {
    const key = keyFor(group, index);
    setAnswers((previous) => ({ ...previous, [key]: answer }));
    if (group === 'blanks') {
      setVerifiedBlanks((previous) => ({ ...previous, [key]: false }));
    }
  };

  if (!bank) {
    const loadingText = status === 'generating' ? 'جارٍ تجهيز الأسئلة…'
      : status === 'offline' ? 'أنت حالياً بدون اتصال'
      : status === 'failed' ? 'تعذر تحميل الاختبار'
      : 'الأسئلة بانتظار التجهيز التلقائي';
    return <div className="space-y-3 rounded-xl border border-line bg-panel p-6 text-center" role="status">
      <BookOpenCheck size={32} className="mx-auto text-brand" />
      <p className="font-bold">{loadingText}</p>
      <p className="text-sm text-muted">{message || 'يولّد النظام بنك الأسئلة ويحفظه مرة واحدة للجميع، دون تحميل PDF على جهازك.'}</p>
      {status !== 'generating' && <button type="button" onClick={() => { setMessage(''); setStatus('pending'); setAttempt((v) => v + 1); }}
        className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-line/30">تحقق مجدداً</button>}
    </div>;
  }

  const questions = bank[section];
  const currentIndex = groups.findIndex((group) => group.key === section);
  const nextGroup = groups.slice(currentIndex + 1).find((group) => bank[group.key].length > 0);

  return <div className="space-y-4">
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">تقدّم الاختبار</span>
        <span className="text-sm text-muted">{score.answered}/{score.total} سؤال موضوعي</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="تقدم الإجابات" aria-valuemin={0} aria-valuemax={score.total} aria-valuenow={score.answered}>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${100 * score.answered / score.total}%` }} />
      </div>
      {showAnswers && <p className="mt-2 font-bold text-brand">نتيجة الأسئلة الموضوعية: {score.correct} / {score.total} (الأسئلة المقالية للمراجعة الذاتية)</p>}
      <p className="mt-2 text-xs text-muted">بعد اختيار إجابة MCQ أو صح/خطأ، يظهر الصحيح بإطار أخضر والخطأ بإطار أحمر. الفراغات تُفحص بزر «تحقق».</p>
    </div>

    <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="أنواع الأسئلة">
      {groups.filter((group) => bank[group.key].length > 0).map((group) => <button key={group.key} type="button" role="tab" aria-selected={section === group.key}
        onClick={() => setSection(group.key)}
        className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${section === group.key ? 'border-brand bg-brand text-onbrand' : 'border-line bg-panel text-muted'}`}>
        {group.short} ({bank[group.key].length})
      </button>)}
    </div>

    <h2 className="text-lg font-bold" dir="auto">{groups.find((group) => group.key === section)?.title}</h2>
    <div className="space-y-3">
      {questions.map((q, i) => {
        const key = keyFor(section, i);
        const answer = answers[key];
        const isMcq = section === 'mcq';
        const isTF = section === 'trueFalse';
        const isBlank = section === 'blanks';
        const mcq = isMcq ? bank.mcq[i] : null;
        const tf = isTF ? bank.trueFalse[i] : null;
        const blank = isBlank ? bank.blanks[i] : null;
        const chosen = Boolean((mcq && typeof answer === 'number') || (tf && typeof answer === 'boolean'));
        const blankChecked = !!blank && (showAnswers || verifiedBlanks[key]);
        const blankHasAnswer = !!blank && typeof answer === 'string' && answer.trim().length > 0;
        const blankCorrect = !!blank && typeof answer === 'string' && isBlankAnswerCorrect(answer, blank.answer);
        const hasFeedback = !!chosen || (blankChecked && blankHasAnswer);
        const isCorrect = mcq ? answer === mcq.answer : tf ? answer === tf.answer : blankCorrect;
        const showModel = showAnswers;
        const explanation = 'explanation' in q ? q.explanation : undefined;
        return <article key={key} className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-start gap-2">
            <span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 text-sm font-semibold text-brand">{i + 1}</span>
            <p dir="auto" className="min-w-0 flex-1 whitespace-pre-wrap font-medium leading-relaxed">{q.question}</p>
          </div>
          {typeof q.page === 'number' && <p className="mt-1 text-end text-xs text-muted">Page {q.page}</p>}

          {mcq && <div className="mt-3 space-y-2" dir="auto">
            {mcq.options.map((option, optionIndex) => {
              const right = (chosen || showAnswers) && optionIndex === mcq.answer;
              const wrong = chosen && answer === optionIndex && optionIndex !== mcq.answer;
              const selected = answer === optionIndex;
              const style = right ? correctStyle : wrong ? incorrectStyle : selected ? 'border-brand bg-brand/10' : neutralStyle;
              return <label key={optionIndex} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${style}`}>
                <input type="radio" name={`${id}-${file}-${key}`} checked={selected} onChange={() => setAnswer(section, i, optionIndex)} className="accent-brand" />
                <span className="min-w-0 flex-1">{String.fromCharCode(65 + optionIndex)}. {option}</span>
                {right && <CheckCircle2 aria-label="الإجابة الصحيحة" size={19} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                {wrong && <XCircle aria-label="إجابة خاطئة" size={19} className="shrink-0 text-rose-600 dark:text-rose-400" />}
              </label>;
            })}
          </div>}

          {tf && <div className="mt-3 flex flex-wrap gap-2" dir="auto">
            {([{ value: true, label: 'True / صح' }, { value: false, label: 'False / خطأ' }] as const).map((option) => {
              const right = (chosen || showAnswers) && option.value === tf.answer;
              const wrong = chosen && option.value === answer && option.value !== tf.answer;
              const selected = answer === option.value;
              const style = right ? correctStyle : wrong ? incorrectStyle : selected ? 'border-brand bg-brand/10' : neutralStyle;
              return <button key={String(option.value)} type="button" aria-pressed={selected} onClick={() => setAnswer(section, i, option.value)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${style}`}>
                {option.label}
                {right && <CheckCircle2 aria-label="الإجابة الصحيحة" size={17} className="text-emerald-600 dark:text-emerald-400" />}
                {wrong && <XCircle aria-label="إجابة خاطئة" size={17} className="text-rose-600 dark:text-rose-400" />}
              </button>;
            })}
          </div>}

          {blank && <div className="mt-3 flex flex-wrap gap-2">
            <input dir="auto" type="text" value={typeof answer === 'string' ? answer : ''}
              onChange={(event) => setAnswer(section, i, event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && blankHasAnswer) { event.preventDefault(); setVerifiedBlanks((previous) => ({ ...previous, [key]: true })); } }}
              placeholder="اكتب الإجابة" aria-label={`إجابة الفراغ ${i + 1}`}
              className={`min-w-0 flex-1 rounded-lg border bg-bg px-3 py-2 outline-none transition-colors focus:ring-1 focus:ring-brand ${blankChecked && blankHasAnswer ? (blankCorrect ? correctStyle : incorrectStyle) : 'border-line focus:border-brand'}`} />
            <button type="button" disabled={!blankHasAnswer} onClick={() => setVerifiedBlanks((previous) => ({ ...previous, [key]: true }))}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-line/30 disabled:cursor-not-allowed disabled:opacity-50">تحقق</button>
          </div>}

          {!mcq && !tf && !blank && <textarea dir="auto" value={typeof answer === 'string' ? answer : ''}
            onChange={(event) => setAnswer(section, i, event.target.value)} rows={3}
            placeholder="دوّن إجابتك قبل عرض النموذجية"
            className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-brand" />}

          {hasFeedback && <p role="status" className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${isCorrect ? `${correctStyle} text-emerald-700 dark:text-emerald-300` : `${incorrectStyle} text-rose-700 dark:text-rose-300`}`}>
            {isCorrect ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            {isCorrect ? 'إجابة صحيحة، أحسنت!' : 'إجابة غير صحيحة، راجع الاختيار الأخضر أو الحل النموذجي.'}
          </p>}

          {((hasFeedback && (mcq || tf)) || showModel) && explanation && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted" dir="auto">{explanation}</p>}

          {showModel && <div className="mt-3 space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm" dir="auto">
            <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} /> الإجابة النموذجية</p>
            <p className="whitespace-pre-wrap">{mcq ? `${String.fromCharCode(65 + mcq.answer)}. ${mcq.options[mcq.answer]}` : tf ? (tf.answer ? 'True' : 'False') : String(q.answer)}</p>
          </div>}
        </article>;
      })}
    </div>

    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setShowAnswers((previous) => !previous)}
        className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand">
        {showAnswers ? 'إخفاء الحلول' : 'عرض جميع الحلول والنتيجة'}
      </button>
      {nextGroup && <button type="button" onClick={() => setSection(nextGroup.key)}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm">
        القسم التالي <ChevronLeft size={15} />
      </button>}
      <button type="button" onClick={() => {
        if (window.confirm('مسح جميع إجاباتك والبدء مجدداً؟')) {
          setAnswers({}); setVerifiedBlanks({}); setShowAnswers(false); setSection('mcq');
        }
      }} className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm">
        <RotateCcw size={15} /> إعادة الاختبار
      </button>
    </div>
    <p className="text-xs text-muted">تصحيح الفراغات يقبل اختلاف الحروف الكبيرة والمسافات وبعض علامات الترقيم والتشكيل. قد تكون صياغة أخرى صحيحة علمياً؛ راجع الإجابة النموذجية. التعاريف والتعاليل والرسومات للمراجعة الذاتية، وليست لها درجة آلية.</p>
  </div>;
}
