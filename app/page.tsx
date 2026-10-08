import Link from 'next/link';
import { COURSES } from '@/lib/courses';
import Schedule from '@/components/Schedule';
import OmniSearch from '@/components/OmniSearch';

export default function Home() {
  return (
    <div className="space-y-8">
      <Schedule />
      <OmniSearch />
      <section aria-label="المواد">
        <h2 className="mb-3 text-xl font-bold">المواد</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {COURSES.map((c) => (
            <Link key={c.slug} href={`/subject/${c.slug}`} className="rounded-xl border border-line bg-panel p-4 hover:border-brand">
              <span className="block font-bold">{c.ar}</span>
              <span className="block text-sm text-muted" dir="ltr">{c.en}</span>
              <span className="mt-1 block text-xs text-muted">{c.split ? 'نظري + مختبر' : 'نظري'}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
