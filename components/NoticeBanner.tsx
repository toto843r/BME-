'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';

interface Notice { id: string; message: string; expires_at: string }

// Light, optional notice: no PDF library and no large bundle loaded on the home page.
export default function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(async () => {
    // Query the public RLS-protected view directly, without bundling the
    // relatively large Supabase SDK on every home-page visit.
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) return;
    try {
      const url = new URL(`${base.replace(/\/$/, '')}/rest/v1/portal_notices`);
      url.searchParams.set('select', 'id,message,expires_at');
      url.searchParams.set('deleted_at', 'is.null');
      url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
      url.searchParams.set('order', 'created_at.desc');
      url.searchParams.set('limit', '1');
      const response = await fetch(url.toString(), {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!Array.isArray(data)) return;
      const first = data[0];
      if (first && typeof first.id === 'string' && typeof first.message === 'string' &&
          typeof first.expires_at === 'string') {
        setNotice({ id: first.id, message: first.message, expires_at: first.expires_at });
      } else {
        setNotice(null);
      }
    } catch {
      // If offline, keep an existing notice only until its expiry.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  useEffect(() => {
    // Do not make recurring network requests when no notice is visible.
    // An admin deletion takes effect on the next visit/focus, or within
    // two minutes for someone already reading an active announcement.
    if (!notice) return;
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 120_000);
    return () => window.clearInterval(poll);
  }, [notice?.id, refresh]);

  useEffect(() => {
    if (!notice) return;
    const ms = Date.parse(notice.expires_at) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) { setNotice(null); return; }
    const timer = window.setTimeout(() => setNotice(null), ms);
    return () => window.clearTimeout(timer);
  }, [notice?.id, notice?.expires_at]);

  if (!notice) return null;
  return (
    <aside role="status" aria-live="polite" className="rounded-xl border border-brand/35 bg-panel px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-brand/10 p-2 text-brand" aria-hidden="true"><Megaphone size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-brand">تبليغ من القسم</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-ink">{notice.message}</p>
          <p className="mt-1 text-xs text-muted">يختفي التبليغ تلقائياً بعد 4 ساعات من نشره.</p>
        </div>
      </div>
    </aside>
  );
}
