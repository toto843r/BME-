import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { CATEGORY_AR, getCourse, TRACK_LABEL } from '@/lib/courses';
import { supabase } from '@/lib/supabase';
import type { Category, Item, Track } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search is performed on the server so visitors do not download the index.
// Only public, approved, non-sensitive metadata is cached for two minutes.
const PAGE_SIZE = 1000;
const MAX_INDEX_SIZE = 5000;
const MAX_RESULTS = 40;

type SearchRow = Pick<Item, 'id' | 'subject_slug' | 'track' | 'category' | 'title' | 'tags' | 'description' | 'created_at'>;

const getSearchIndex = unstable_cache(async (): Promise<SearchRow[]> => {
  const rows: SearchRow[] = [];
  for (let start = 0; start < MAX_INDEX_SIZE; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('items')
      .select('id,subject_slug,track,category,title,tags,description,created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error('Search index unavailable');
    rows.push(...((data || []) as SearchRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}, ['bme-public-search-index-v1'], { revalidate: 120 });

function haystack(row: SearchRow): string {
  const course = getCourse(row.subject_slug);
  // Keep all original search fields: title, description, tags, course,
  // instructor, category and theory/lab labels.
  return [
    row.title,
    row.description,
    ...(Array.isArray(row.tags) ? row.tags : []),
    course?.ar,
    course?.en,
    course?.instructors[row.track as Track],
    CATEGORY_AR[row.category as Category],
    TRACK_LABEL[row.track as Track],
  ].filter(Boolean).join(' ').toLowerCase();
}

function relevance(row: SearchRow, phrase: string, terms: string[]): number {
  const title = row.title.toLowerCase();
  if (title.includes(phrase)) return 3;
  if (terms.every((term) => title.includes(term))) return 2;
  return 1;
}

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') || '').trim();
  if (query.length < 2) return json({ items: [] });
  if (query.length > 100) return json({ error: 'Query is too long' }, 400);
  const phrase = query.toLowerCase();
  const terms = phrase.split(/\s+/).filter(Boolean);

  try {
    const index = await getSearchIndex();
    const ids = index
      .filter((row) => {
        const allText = haystack(row);
        return terms.every((term) => allText.includes(term));
      })
      .sort((a, b) => relevance(b, phrase, terms) - relevance(a, phrase, terms) ||
        b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_RESULTS)
      .map((row) => row.id);

    if (!ids.length) return json({ items: [] });

    // Get full cards (including attachments) only for the matching IDs.
    // RLS still limits the database query to approved public items.
    const { data, error } = await supabase.from('items')
      .select('id,subject_slug,track,category,title,tags,badges,file_path,file_kind,attachments,external_url,uploader_name,status,exam_pick,description,created_at')
      .eq('status', 'approved')
      .in('id', ids);
    if (error) throw new Error('Search results unavailable');
    const byId = new Map(((data || []) as Item[]).map((item) => [item.id, item]));
    return json({ items: ids.map((id) => byId.get(id)).filter(Boolean) });
  } catch {
    return json({ error: 'Search temporarily unavailable' }, 503);
  }
}
