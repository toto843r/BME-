'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/types';
import { getCourse } from '@/lib/courses';
import PreviewModal from './PreviewModal';
import BackButton from './BackButton';

export default function SharedFile({ id }: { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    supabase.from('items').select('*').eq('id', id).eq('status', 'approved').maybeSingle()
      .then(({ data }) => {
        if (data) { setItem(data as Item); setState('ok'); } else setState('missing');
      });
  }, [id]);

  if (state === 'loading') return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (state === 'missing' || !item) {
    return (
      <div className="rounded-xl border border-line p-6 text-center">
        <p className="mb-3">هذا الملف غير موجود أو لم تتم الموافقة عليه بعد.</p>
        <BackButton fallback="/" />
      </div>
    );
  }

  const course = getCourse(item.subject_slug);
  const href = `/subject/${item.subject_slug}${item.track !== 'main' ? `?track=${item.track}` : ''}`;
  return (
    <div>
      <h1 className="text-xl font-bold">{item.title}</h1>
      <p className="mb-4 text-sm text-muted">{course?.ar}</p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(true)} className="rounded-lg bg-brand px-4 py-2 font-semibold text-onbrand">فتح الملف</button>
        <Link href={href} className="rounded-lg border border-line bg-panel px-4 py-2">كل ملفات المادة</Link>
      </div>
      <PreviewModal item={open ? item : null} onClose={() => setOpen(false)} />
    </div>
  );
}
