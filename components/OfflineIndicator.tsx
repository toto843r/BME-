'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return offline ? <div role="status" aria-live="polite" className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-xl sm:right-auto sm:mx-0">
    <WifiOff size={18} className="shrink-0 text-brand" />
    <span>أنت تتصفح بدون اتصال (الجدول والبيانات المحفوظة متاحة)</span>
  </div> : null;
}
