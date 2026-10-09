'use client';
import { useEffect, useState } from 'react';
import { formativeFor, MIDTERM, type Part } from '@/lib/assessment';

const num = (v: string | undefined, max: number) => {
  const n = parseFloat((v || '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};
const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

export default function Assessment({ slug }: { slug: string }) {
  const storeKey = `bme-sai-${slug}`;
  const [vals, setVals] = useState<Record<string, string>>({});

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

  const formative = formativeFor(slug);
  const formMax = formative.reduce((s, p) => s + p.max, 0);
  const totalMax = MIDTERM.max + formMax;
  const mid = num(vals[MIDTERM.key], MIDTERM.max);
  const form = formative.reduce((s, p) => s + num(vals[p.key], p.max), 0);
  const total = mid + form;
  const pct = totalMax ? (total / totalMax) * 100 : 0;

  const row = (p: Part) => (
    <label key={p.key} className="flex items-center gap-3 py-1.5">
      <span className="flex-1 text-sm">{p.ar}</span>
      <input type="number" inputMode="decimal" step="0.25" min={0} max={p.max} dir="ltr"
        value={vals[p.key] ?? ''} placeholder="0"
        onChange={(e) => set(p.key, e.target.value)}
        onBlur={(e) => e.target.value !== '' && set(p.key, f(num(e.target.value, p.max)))}
        className="w-20 rounded-lg border border-line bg-bg px-2 py-1.5 text-center outline-none focus:border-brand" />
      <span className="w-10 text-sm text-muted" dir="ltr">/ {p.max}</span>
    </label>
  );

  return (
    <section className="mb-6 rounded-2xl border-2 border-brand bg-panel p-4" aria-label="السعي">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">السعي</h2>
          <p className="text-xs text-muted">درجاتك تُحفظ على جهازك فقط ولا تُرسل لأحد.</p>
        </div>
        <p className="text-3xl font-bold text-brand" dir="ltr">
          {f(total)}<span className="text-lg font-normal text-muted"> / {totalMax}</span>
        </p>
      </div>

      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-line" role="progressbar"
        aria-valuenow={Math.round(total * 100) / 100} aria-valuemin={0} aria-valuemax={totalMax}>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">المتبقي من السعي: {f(totalMax - total)}</p>

      <div className="mt-4 divide-y divide-line">
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
    </section>
  );
}
