'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formativeFor, MIDTERM, type Part } from '@/lib/assessment';

const num = (v: string | undefined, max: number) => {
  const n = parseFloat((v || '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};
const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

export default function Assessment({ slug }: { slug: string }) {
  const storeKey = `bme-sai-${slug}`;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    try { setVals(JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch {}
  }, [storeKey]);

  const set = (k: string, v: string) =>
    setVals((p) => {
      const n = { ...p, [k]: v };
      try { localStorage.setItem(storeKey, JSON.stringify(n)); } catch {}
      return n;
    });
  const reset = () => {
    if (!window.confirm('مسح كل درجات هذه المادة؟')) return;
    setVals({});
    try { localStorage.removeItem(storeKey); } catch {}
  };

  // reject anything above the max (or negative): the field keeps its old value and shows a warning
  const onType = (p: Part, v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    if (v !== '' && Number.isFinite(n) && (n > p.max || n < 0)) {
      setWarn(p.key);
      window.setTimeout(() => setWarn((w) => (w === p.key ? null : w)), 2500);
      return;
    }
    set(p.key, v);
  };

  const formative = formativeFor(slug);
  const formMax = formative.reduce((s, p) => s + p.max, 0);
  const totalMax = MIDTERM.max + formMax;
  const mid = num(vals[MIDTERM.key], MIDTERM.max);
  const form = formative.reduce((s, p) => s + num(vals[p.key], p.max), 0);
  const total = mid + form;
  const pct = totalMax ? (total / totalMax) * 100 : 0;

  const row = (p: Part) => (
    <div key={p.key} className="py-1.5">
      <label className="flex items-center gap-3">
        <span className="flex-1 text-sm">{p.ar}</span>
        <input type="number" inputMode="decimal" step="0.25" min={0} max={p.max} dir="ltr"
          value={vals[p.key] ?? ''} placeholder="0"
          onChange={(e) => onType(p, e.target.value)}
          className={`w-20 rounded-lg border bg-bg px-2 py-1.5 text-center outline-none focus:border-brand ${warn === p.key ? 'border-red-500' : 'border-line'}`} />
        <span className="w-10 text-sm text-muted" dir="ltr">/ {p.max}</span>
      </label>
      {warn === p.key && (
        <p role="alert" className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          الدرجة أعلى من الحد الأعلى ({p.max}) – لم تُقبل.
        </p>
      )}
    </div>
  );

  return (
    <section className="mb-6 rounded-2xl border-2 border-brand bg-panel" aria-label="السعي">
      {/* always visible: title + counter + bar. Tap to show / hide the details */}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block w-full p-4 text-start">
        <span className="flex items-end justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="text-xl font-bold">السعي</span>
            <ChevronDown size={20} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
          <span className="text-3xl font-bold text-brand" dir="ltr">
            {f(total)}<span className="text-lg font-normal text-muted"> / {totalMax}</span>
          </span>
        </span>
        <span className="mt-3 block h-4 w-full overflow-hidden rounded-full bg-line" role="progressbar"
          aria-valuenow={Math.round(total * 100) / 100} aria-valuemin={0} aria-valuemax={totalMax}>
          <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className="mt-1 block text-xs text-muted">
          المتبقي: {f(totalMax - total)} – {open ? 'اضغط للإخفاء' : 'اضغط لإدخال الدرجات'}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <p className="mb-2 text-xs text-muted">درجاتك تُحفظ على جهازك فقط ولا تُرسل لأحد.</p>
          <div className="divide-y divide-line">
            <div className="pb-2">{row(MIDTERM)}</div>
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">السعي التكويني</h3>
                <span className="text-sm font-bold text-brand" dir="ltr">{f(form)} / {formMax}</span>
              </div>
              {formative.map(row)}
            </div>
          </div>
          <button onClick={reset} className="mt-3 text-xs text-muted underline">مسح الدرجات</button>
        </div>
      )}
    </section>
  );
}
