'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Moon, Sun, Upload } from 'lucide-react';

export default function Header() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('bme-theme', next ? 'dark' : 'light'); } catch {}
  }
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand">هندسة طبية · ٤</Link>
        <nav className="flex items-center gap-1">
          <Link href="/upload" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-line/60">
            <Upload size={16} /> رفع ملف
          </Link>
          <button onClick={toggle} aria-label="تبديل الوضع الداكن" className="rounded-lg p-2 hover:bg-line/60">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
