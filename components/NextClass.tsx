'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DAYS_AR, SCHEDULE } from '@/lib/schedule';
import { getCourse, TRACK_LABEL } from '@/lib/courses';

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function fmt(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} دقيقة`;
  return m === 0 ? `${h} ساعة` : `${h} ساعة و ${m} دقيقة`;
}

const hrefOf = (slug: string, track: string) => `/subject/${slug}${track !== 'main' ? `?track=${track}` : ''}`;

// College schedules use Baghdad time even when a student travels abroad.
// Convert the same server-supplied timestamp on the server and client, so
// the first rendered HTML matches hydration exactly.
const baghdadClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Baghdad',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayNumber: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function clockAt(instant: number): { today: number; cur: number } {
  const parts = baghdadClock.formatToParts(new Date(instant));
  const get = (name: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === name)?.value ?? '';
  return {
    today: weekdayNumber[get('weekday')] ?? 0,
    cur: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

type Group = 'A' | 'B';

export default function NextClass({ initialNow, initialGroup }: { initialNow: string; initialGroup: Group }) {
  // Do not wait for useEffect to show the schedule: the server can render
  // the upcoming class immediately, improving the reported text LCP delay.
  const [now, setNow] = useState(() => Date.parse(initialNow));
  const [group, setGroup] = useState<Group>(initialGroup);
  const [open, setOpen] = useState<number[]>([]);

  useEffect(() => {
    try {
      const g = localStorage.getItem('bme-group');
      if (g === 'A' || g === 'B') {
        setGroup(g);
        // Migrate an existing preference to the SSR cookie on first visit.
        document.cookie = `bme-group=${g}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
    } catch { /* Storage can be blocked in private browsing */ }
    // Refresh after hydration and when the tab becomes active again.
    // Keep only one interval and stop updating a hidden tab.
    const update = () => {
      if (!document.hidden) setNow(Date.now());
    };
    update();
    const t = window.setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const pickGroup = (g: Group) => {
    setGroup(g);
    try { localStorage.setItem('bme-group', g); } catch {}
    // Makes the preferred group available to the next server render.
    try { document.cookie = `bme-group=${g}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
  };
  const toggleDay = (d: number) => setOpen((o) => (o.includes(d) ? o.filter((x) => x !== d) : [...o, d]));

  const mine = SCHEDULE.filter((s) => s.group === group);
  const { today, cur } = clockAt(now);

  // ---- next / live lecture
  const live = mine.find((s) => s.day === today && mins(s.start) <= cur && cur < mins(s.end));
  let target = live;
  let when = '';
  if (live) {
    when = `تنتهي بعد ${fmt(mins(live.end) - cur)}`;
  } else {
    let best: { s: (typeof mine)[number]; wait: number } | null = null;
    for (const s of mine) {
      let wait = ((s.day - today + 7) % 7) * 1440 + mins(s.start) - cur;
      if (wait <= 0) wait += 7 * 1440;
      if (!best || wait < best.wait) best = { s, wait };
    }
    if (best) {
      target = best.s;
      const dayOffset = Math.floor((cur + best.wait) / 1440);
      if (dayOffset === 0) when = `بعد ${fmt(best.wait)}`;
      else if (dayOffset === 1) when = `غداً الساعة ${best.s.start}`;
      else when = `يوم ${DAYS_AR[best.s.day]} الساعة ${best.s.start}`;
    }
  }
  const c = target ? getCourse(target.slug) : null;

  return (
    <section className={`overflow-hidden rounded-2xl border-2 bg-panel ${live ? 'border-now' : 'border-brand'}`}>
      {target && c && (
        <Link href={hrefOf(target.slug, target.track)} className={`flex items-center gap-4 p-4 ${live ? 'bg-now/20' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{live ? 'الآن' : 'محاضرتك الجاية'} – شعبة {group}</p>
            <p className="text-xl font-bold leading-snug">
              {c.ar}{target.track !== 'main' && ` (${TRACK_LABEL[target.track]})`}
            </p>
            {target.room && <p className="text-sm text-muted">{target.room}</p>}
          </div>
          <p className="shrink-0 text-end text-lg font-bold text-brand">{when}</p>
        </Link>
      )}

      <div className="p-4 pt-3">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-sm font-bold">الجدول</span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="اختيار الشعبة">
            {(['A', 'B'] as const).map((g) => (
              <button key={g} onClick={() => pickGroup(g)} aria-pressed={group === g}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${group === g ? 'bg-brand text-onbrand' : 'text-muted'}`}>
                شعبة {g}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-line">
          {DAYS_AR.map((name, d) => {
            const sessions = mine.filter((s) => s.day === d).sort((a, b) => mins(a.start) - mins(b.start));
            const isOpen = open.includes(d);
            // Count lecture/lab sessions, not individual 60-minute slots.
            const lectureCount = sessions.length;
            return (
              <li key={d}>
                <button onClick={() => toggleDay(d)} aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 py-2.5 text-start">
                  <span className={`font-semibold ${today === d ? 'text-brand' : ''}`}>{name}</span>
                  {today === d && <span className="rounded bg-brand/15 px-1.5 text-xs font-semibold text-brand">اليوم</span>}
                  <span className="flex-1 text-xs text-muted">{lectureCount ? `${lectureCount} محاضرات` : 'لا محاضرات'}</span>
                  <ChevronDown size={18} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="space-y-2 pb-3">
                    {sessions.length === 0 && <p className="text-sm text-muted">لا توجد محاضرات في هذا اليوم.</p>}
                    {sessions.map((s) => {
                      const co = getCourse(s.slug);
                      if (!co) return null;
                      const isLive = today === d && cur >= mins(s.start) && cur < mins(s.end);
                      return (
                        <Link key={s.start + s.slug + s.track} href={hrefOf(s.slug, s.track)}
                          className={`block rounded-lg border p-2.5 text-sm ${isLive ? 'border-now bg-now/20' : 'border-line hover:bg-line/50'}`}>
                          {isLive && <span className="mb-1 inline-block rounded bg-now px-1.5 text-xs font-bold text-[#10242B]">الآن</span>}
                          <span className="block font-semibold leading-snug">
                            {co.ar}{s.track !== 'main' && ` (${TRACK_LABEL[s.track]})`}
                          </span>
                          <span className="block text-xs text-muted">
                            <bdi>{s.start}–{s.end}</bdi>{s.room && ` – ${s.room}`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
