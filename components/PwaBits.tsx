'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function PwaBits() {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone || localStorage.getItem('bme-install-dismissed')) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e); setHidden(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden) return null;
  const close = () => { setHidden(true); try { localStorage.setItem('bme-install-dismissed', '1'); } catch {} };
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-panel p-3 shadow-lg">
      <Download size={20} className="shrink-0 text-brand" />
      <p className="flex-1 text-sm">
        {ios ? 'لتثبيت التطبيق: اضغط زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».' : 'ثبّت البوابة على شاشتك الرئيسية لفتحها كتطبيق.'}
      </p>
      {evt && (
        <button onClick={async () => { await evt.prompt(); close(); }}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-onbrand">تثبيت</button>
      )}
      <button onClick={close} aria-label="إغلاق" className="p-1 text-muted"><X size={16} /></button>
    </div>
  );
}
