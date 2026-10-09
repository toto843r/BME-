import type { Item, Track } from './types';
export interface RecentFile { itemId: string; index: number; title: string; filename: string; at: number; }
export const recentKey = (slug: string, track: Track) => `bme-recent-v1-${slug}-${track}`;
export const itemFiles = (item: Item) => [
  ...(item.file_path ? [{ path: item.file_path, kind: item.file_kind, name: item.title }] : []),
  ...(item.attachments || []),
];
export function readRecent(slug: string, track: Track): RecentFile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(recentKey(slug, track)) || '[]');
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.itemId === 'string' && Number.isInteger(r.index)).slice(0, 5) : [];
  } catch { return []; }
}
export function recordRecent(item: Item, index: number) {
  try {
    const f = itemFiles(item)[index];
    if (!f) return;
    const prev = readRecent(item.subject_slug, item.track);
    const list = [{ itemId: item.id, index, title: item.title,
      filename: f.name || `${item.title} (${index + 1})`, at: Date.now() },
      ...prev.filter((r) => !(r.itemId === item.id && r.index === index))].slice(0, 5);
    localStorage.setItem(recentKey(item.subject_slug, item.track), JSON.stringify(list));
    window.dispatchEvent(new Event('bme-recent-changed'));
  } catch { /* storage disabled */ }
}
