import BackButton from '@/components/BackButton';
import QuizClient from '@/components/QuizClient';
export default async function QuizPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ file?: string }> }) {
  const { id } = await params;
  const { file = '' } = await searchParams;
  return <div className="mx-auto max-w-3xl space-y-5">
    <BackButton fallback="/" />
    <h1 className="text-2xl font-bold">اختبر نفسك</h1>
    <p className="text-sm text-muted">أسئلة جامعية متوسطة وتميل للصعوبة قليلاً، مُولّدة من محتوى الملزمة ومحفوظة للاستخدام المتكرر.</p>
    <QuizClient id={id} file={file} />
  </div>;
}
