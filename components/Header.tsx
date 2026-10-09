'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link2, Moon, Shield, Sun, Upload } from 'lucide-react';

export default function Header() {
  const [dark, setDark] = useState(false);
  const router = useRouter();
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
          <Link href="/upload" className="upload-link-default flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-line/60">
            <Upload size={16} /> رفع ملف
          </Link>
          <a href="/upload?category=videos"
            onClick={(e) => {
              e.preventDefault();
              const d = document.documentElement.dataset;
              router.push(`/upload?category=videos&slug=${d.slug || ''}&track=${d.track || ''}`);
            }}
            className="upload-link-video flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-line/60">
            <Link2 size={16} /> إضافة رابط شرح
          </a>
          <Link href="/admin" aria-label="لوحة الإدارة" title="لوحة الإدارة" className="rounded-lg p-2 hover:bg-line/60"><Shield size={18} /></Link>
          <button onClick={toggle} aria-label="تبديل الوضع الداكن" className="rounded-lg p-2 hover:bg-line/60">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
