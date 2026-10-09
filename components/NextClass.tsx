'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DAYS_AR, SCHEDULE } from '@/lib/schedule';
import { getCourse, TRACK_LABEL } from '@/lib/courses';

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function fmt(total: number) {
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m} دقيقة`;
  return m === 0 ?t Link from ':use client';
import Link f
}

export default function NextClass() {
  const [now, setNow] = useState<Date | null>(null);
  const [group, setGroup] = useState<'A' | 'B'>('A');

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      const g = localStorage.getItem('bme-group');
      setGroup(g === 'B' ? 'B' : 'A');
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;
  const mine = SCHEDULE.filter((s) => s.group === group);
  if (mine.length === 0) return null;

  const today = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();

  const live = mine.find((s) => s.day === today && mins(s.start) <= cur && cur < mins(s.end));
  let target = live;
  let when = '';

  if (live) {
    when =   };
    tick();
    const t = setInterva
  } else {
    let best: { s: (typeof mine)[number]; wait: number } | null = null;
    for (const s of mine) {
      let wait = ((s.day - today + 7) % 7) * 1440 + mins(s.start) - cur;
      if (wait <= 0) wait += 7 * 1440;
      if (!best || wait < best.wait) best = { s, wait };
    }
    if (!best) return null;
    target = best.s;
    const dayOffset = Math.floor((cur + best.wait) / 1440);
    if (dayOffset === 0) when =? `${h} ساعة` : `${h} ساع
    else if (dayOffset === 1) when =link';
import { useEffect, useS
    else when =port Link from 'next/link';
import { useEffect, useSt
  }

  const c = target ? getCourse(target.slug) : null;
  if (!target || !c) return null;
  const href = SCHEDULE } from '@/lib/schedule';
import { getCourse, track=${target.track}` : ''}`;

  return (
    <Link href={href}
      className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${live ? 'border-now bg-now/20' : 'border-brand bg-panel'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{live ? 'الآن' : 'محاضرتك الجاية'} – شعبة {group}</p>
        <p className="text-xl font-bold leading-snug">
          {c.ar}{target.track !== 'main' && ` (${TRACK_LABEL[target.track]})`}
        </p>
        {target.room && <p className="text-sm text-muted">{target.room}</p>}
      </div>
      <p className="shrink-0 text-end text-lg font-bold text-brand">{when}</p>
    </Link>
  );
}
