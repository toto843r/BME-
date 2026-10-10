'use client';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

/** Navigate one page backwards within the portal, falling back safely for direct links. */
export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();
  function goBack() {
    const nextIndex = window.history.state?.idx;
    let sameOriginReferrer = false;
    try { sameOriginReferrer = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch {}
    // Never accidentally send a student to an external website from an opened share link.
    if ((typeof nextIndex === 'number' && nextIndex > 0) || sameOriginReferrer) router.back();
    else router.push(fallback);
  }
  return (
    <button type="button" onClick={goBack} aria-label="العودة للصفحة السابقة"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowRight size={16} aria-hidden="true" /> رجوع
    </button>
  );
}
