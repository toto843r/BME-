import Link from 'next/link';
import QuizClient from '@/components/QuizClient';
export default function QuizPage({ params, searchParams }: { params: { id: string }; searchParams: { file?: string } }) {
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/" className="inline-block text-sm text-muted hover:text-ink">← الرئيسية</Link>
    <h1 className="text-2xl font-bold">اختبر نفسك</h1>
    <p className="text-sm text-muted">أسئلة جامعية متوسطة وتميل للصعوبة قليلاً، مُولّدة من محتوى الملزمة ومحفوظة للاستخدام المتكرر.</p>
    <QuizClient id={params.id} file={searchParams.file || ''} />
  </div>;
}
