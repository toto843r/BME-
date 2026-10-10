import Link from 'next/link';
import { cookies } from 'next/headers';
import { COURSES } from '@/lib/courses';
import NextClass from '@/components/NextClass';
import OmniSearch from '@/components/OmniSearch';

// The clock in the upcoming-lecture card must be fresh on every visit.
// Render it on the server rather than waiting for client hydration.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const cookieStore = await cookies();
  const savedGroup = cookieStore.get('bme-group')?.value;
  const initialGroup: 'A' | 'B' = savedGroup === 'B' ? 'B' : 'A';
  const initialNow = new Date().toISOString();
  return (
    <div className="space-y-8">
      <NextClass initialNow={initialNow} initialGroup={initialGroup} />
      <Link href="/schedule" className="inline-flex rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-brand hover:border-brand">الجدول الكامل والقاعات ←</Link>
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
