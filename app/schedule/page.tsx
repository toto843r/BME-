import Link from 'next/link';
import Schedule from '@/components/Schedule';
export default function SchedulePage() {
  return <div><Link href="/" className="mb-5 inline-block text-sm text-muted">← الرئيسية</Link><Schedule /></div>;
}
