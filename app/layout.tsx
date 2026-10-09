import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import PwaBits from '@/components/PwaBits';
import OfflineIndicator from '@/components/OfflineIndicator';

const font = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: 'بوابة الهندسة الطبية – المرحلة الرابعة',
  description: 'بوابة الهندسة الطبية الحياتية: ملازم، جداول، قاعات، مواد واختبارات تفاعلية',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'BME Portal', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F2F6F6' }, { media: '(prefers-color-scheme: dark)', color: '#0C1417' }],
};

const themeScript = `try{var t=localStorage.getItem('bme-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={font.className}>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <PwaBits />
        <OfflineIndicator />
      </body>
    </html>
  );
}
