import BackButton from '@/components/BackButton';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COURSES, getCourse, TRACK_LABEL } from '@/lib/courses';
import type { Track } from '@/lib/types';
import SubjectView from '@/components/SubjectView';
import Assessment from '@/components/Assessment';
import { BookOpen, FlaskConical } from 'lucide-react';

export const generateStaticParams = () => COURSES.map((c) => ({ slug: c.slug }));

export default async function SubjectPage({ params, searchParams }:
  { params: Promise<{ slug: string }>; searchParams: Promise<{ track?: string }> }) {
  const { slug } = await params;
  const { track: requestedTrack } = await searchParams;
  const course = getCourse(slug);
  if (!course) notFound();

  const wanted = requestedTrack;
  const track: Track | null = course.split
    ? (wanted === 'theory' || wanted === 'lab' ? wanted : null)
    : 'main';

  return (
    <div>
      <BackButton fallback={track ? `/subject/${slug}` : '/'} />
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
          {track !== 'lab' && <Assessment slug={course.slug} />}
          <SubjectView slug={course.slug} track={track} />
        </>
      )}
    </div>
  );
}
