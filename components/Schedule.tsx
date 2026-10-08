'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DAYS_AR, SCHEDULE } from '@/lib/schedule';
import { getCourse, TRACK_LABEL } from '@/lib/courses';

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export default function Schedule() {
  const [group, setGroup] = useState<'A' | 'B'>('A');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const g = localStorage.getItem('bme-group');
    if (g === 'A' || g === 'B') setGroup(g);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const pick = (g: 'A' | 'B') => { setGroup(g); try { localStorage.setItem('bme-group', g); } catch {} };

  const today = now?.getDay();
  const cur = now ? now.getHours() * 60 + now.getMinutes() : -1;

  return (
    <section aria-labelledby="sch">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="sch" className="text-xl font-bold">جدول الأسبوع</h2>
        <div className="flex rounded-lg border border-line bg-panel p-0.5" role="group" aria-label="اختيار الشعبة">
          {(['A', 'B'] as const).map((g) => (
            <button key={g} onClick={() => pick(g)} aria-pressed={group === g}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${group === g ? 'bg-brand text-onbrand' : 'text-muted'}`}>
              شعبة {g}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {DAYS_AR.map((name, d) => {
          const sessions = SCHEDULE.filter((s) => s.group === group && s.day === d).sort((a, b) => mins(a.start) - mins(b.start));
          const isToday = today === d;
          return (
            <div key={d} className={`rounded-xl border p-2.5 ${isToday ? 'border-brand' : 'border-line'} bg-panel`}>
              <h3 className={`mb-2 text-sm font-bold ${isToday ? 'text-brand' : 'text-muted'}`}>{name}{isToday && ' (اليوم)'}</h3>
              <div className="space-y-2">
                {sessions.length === 0 && <p className="text-xs text-muted">لا محاضرات</p>}
                {sessions.map((s) => {
                  const c = getCourse(s.slug);
                  if (!c) return null;
                  const live = isToday && cur >= mins(s.start) && cur < mins(s.end);
                  const href = `/subject/${s.slug}${s.track !== 'main' ? `?track=${s.track}` : ''}`;
                  return (
                    <Link key={s.start + s.slug} href={href}
                      className={`block rounded-lg border p-2 text-sm ${live ? 'border-now bg-now/20' : 'border-line hover:bg-line/50'}`}>
                      {live && <span className="mb-1 inline-block rounded bg-now px-1.5 text-xs font-bold text-[#10242B]">الآن</span>}
                      <span className="block font-semibold leading-snug">{c.ar}</span>
                      <span className="block text-xs text-muted">
                        {s.track !== 'main' && `${TRACK_LABEL[s.track]} – `}<bdi>{s.start}–{s.end}</bdi>{s.room && ` – ${s.room}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
