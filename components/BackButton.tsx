'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

const ROUTE_KEY = 'bme-in-app-navigation-v2';
const MAX_AGE_MS = 60 * 60 * 1000;

type RouteRecord = { from: string; to: string; time: number };

/**
 * Save the previous *portal URL* when navigating from a page that has a Back
 * button. Browser history (including Next's idx) can contain duplicate URLs,
 * external sites and PWA activation entries; a recorded route is more reliable.
 * The stored destination must match the current route before we use it, so an
 * old visit can never send someone to an unrelated course.
 */
export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();

  useEffect(() => {
    const rememberNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      try {
        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        const from = window.location.pathname + window.location.search;
        const to = destination.pathname + destination.search;
        if (from === to) return;
        const record: RouteRecord = { from, to, time: Date.now() };
        sessionStorage.setItem(ROUTE_KEY, JSON.stringify(record));
      } catch { /* Private-mode storage is optional; fallback stays functional. */ }
    };
    document.addEventListener('click', rememberNavigation, true);
    return () => document.removeEventListener('click', rememberNavigation, true);
  }, []);

  function goBack() {
    const current = window.location.pathname + window.location.search;
    let destination = fallback;
    try {
      const saved = sessionStorage.getItem(ROUTE_KEY);
      sessionStorage.removeItem(ROUTE_KEY);
      if (saved) {
        const record = JSON.parse(saved) as RouteRecord;
        if (record.to === current &&
            record.time > Date.now() - MAX_AGE_MS && record.time <= Date.now() &&
            typeof record.from === 'string' && record.from.startsWith('/') &&
            !record.from.startsWith('//') && record.from !== current) {
          destination = record.from;
        }
      }
    } catch { /* Fall back to the appropriate parent page. */ }

    // Never navigate to the exact same page, and never leave this site.
    const safeDestination = destination.startsWith('/') && !destination.startsWith('//') &&
      destination !== current ? destination : '/';
    router.push(safeDestination);
  }

  return (
    <button type="button" onClick={goBack} aria-label="العودة للصفحة السابقة"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowRight size={16} aria-hidden="true" /> رجوع
    </button>
  );
}
