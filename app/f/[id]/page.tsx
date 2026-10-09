import type { Metadata } from 'next';
import SharedFile from '@/components/SharedFile';
import { getCourse } from '@/lib/courses';

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fallback = { title: 'بوابة الهندسة الطبية – المرحلة الرابعة' };
  if (!UUID.test(id)) return fallback;
  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/items?id=eq.${id}&status=eq.approved&select=title,subject_slug&limit=1`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
    const [it] = await res.json();
    if (!it) return fallback;
    const title = `${it.title} – ${getCourse(it.subject_slug)?.ar ?? ''}`;
    return { title, openGraph: { title, description: 'بوابة الهندسة الطبية – المرحلة الرابعة', type: 'website' } };
  } catch {
    return fallback;
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedFile id={id} />;
}
