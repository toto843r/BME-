import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COURSES, getCourse, TRACK_LABEL } from '@/lib/courses';
import type { Track } from '@/lib/types';
import SubjectView from '@/components/SubjectView';
import { BookOpen, FlaskConical } from 'lucide-react';

export const generateStaticParams = () => COURSES.map((c) => ({ slug: c.slug }));

export default function SubjectPage({ params, searchParams }:
  { params: { slug: string }; searchParams: { track?: string } }) {
  const course = getCourse(params.slug);
  if (!course) notFound();

  const wanted = searchParams.track;
  const track: Track | null = course.split
    ? (wanted === 'theory' || wanted === 'lab' ? wanted : null)
    : 'main';

  return (
    <div>
      <Link href="/" className="text-sm text-muted hover:text-ink">← الرئيسية</Link>
      <h1 className="mt-2 text-2xl font-bold">{course.ar}</h1>
      <p className="mb-5 text-sm text-muted" dir="ltr" style={{ textAlign: 'start' }}>
        {course.en}{track && course.instructors[track] ? ` – ${course.instructors[track]}` : ''}
      </p>

      {track === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['theory', 'lab'] as const).map((t) => (
            <Link key={t} href={`/subject/${course.slug}?track=${t}`}
              className="rounded-2xl border border-line bg-panel p-5 hover:border-brand">
              {t === 'theory' ? <BookOpen className="mb-2 text-brand" /> : <FlaskConical className="mb-2 text-brand" />}
              <span className="block text-lg font-bold">{TRACK_LABEL[t]} <span className="text-sm font-normal text-muted" dir="ltr">{t === 'theory' ? 'Theory' : 'Laboratory'}</span></span>
              <span className="mt-1 block text-sm text-muted" dir="ltr" style={{ textAlign: 'start' }}>{course.instructors[t]}</span>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {course.split && (
            <div className="mb-4 flex gap-2 text-sm">
              {(['theory', 'lab'] as const).map((t) => (
                <Link key={t} href={`/subject/${course.slug}?track=${t}`}
                  className={`rounded-lg px-3 py-1.5 ${track === t ? 'bg-brand font-semibold text-onbrand' : 'border border-line bg-panel text-muted'}`}>
                  {TRACK_LABEL[t]}
                </Link>
              ))}
            </div>
          )}
          <SubjectView slug={course.slug} track={track} />
        </>
      )}
    </div>
  );
}
