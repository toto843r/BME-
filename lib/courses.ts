import type { Category, Track } from './types';

export interface Course {
  slug: string;
  ar: string;
  en: string;
  split: boolean; // true => Theory / Lab branching
  instructors: Partial<Record<Track, string>>;
}

export const COURSES: Course[] = [
  { slug: 'biomedical-sensors', ar: 'المتحسسات الحيوية', en: 'Biomedical Sensors', split: true,
    instructors: { theory: 'Dr. Mahmoud', lab: 'Dr. Yasser' } },
  { slug: 'control-systems', ar: 'أنظمة السيطرة', en: 'Control Systems', split: true,
    instructors: { theory: 'Prof. Kholoud Iskandar', lab: 'A.L. Sadeem' } },
  { slug: 'microcontroller', ar: 'المتحكمات الدقيقة', en: 'Microcontroller', split: true,
    instructors: { theory: 'Assist. Prof. Dr. Muhannad', lab: 'Assist. Prof. Dr. Muhannad & A.L. Sadeem' } },
  { slug: 'medical-measurements', ar: 'القياسات الطبية', en: 'Medical Measurements', split: true,
    instructors: { theory: "Dr. Zahraa, Dr. Na'am & A.L. Alaa", lab: "Dr. Zahraa, Dr. Na'am & A.L. Alaa" } },
  { slug: 'artificial-limbs', ar: 'الأطراف والمساند الصناعية', en: 'Artificial Limbs', split: false,
    instructors: { main: 'Dr. Waleed' } },
  { slug: 'dynamics-of-human', ar: 'ديناميكا جسم الإنسان', en: 'Dynamics of Human', split: false,
    instructors: { main: 'Prof. Dr. Hussam' } },
];

export const getCourse = (slug: string) => COURSES.find((c) => c.slug === slug);
export const TRACK_LABEL: Record<Track, string> = { theory: 'نظري', lab: 'مختبر', main: '' };

export const CATEGORIES: { key: Category; ar: string; en: string }[] = [
  { key: 'lectures', ar: 'الملازم', en: 'Lectures & Slides' },
  { key: 'quizzes', ar: 'الكوزات', en: 'Quizzes' },
  { key: 'midterms', ar: 'المدات', en: 'Midterm Exams' },
  { key: 'finals', ar: 'الفاينلات', en: 'Finals & Previous Years' },
  { key: 'summaries', ar: 'الملخصات', en: 'Summaries & Cheat Sheets' },
  { key: 'videos', ar: 'الشروحات', en: 'Video Tutorials & Links' },
];
export const CATEGORY_AR = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.ar])) as Record<Category, string>;
// Exam Crunch Mode keeps only these, in this order
export const CRUNCH: Category[] = ['finals', 'midterms', 'quizzes', 'summaries'];

export const BADGES: { key: string; label: string; cls: string }[] = [
  { key: 'high_yield', label: 'مهم جداً', cls: 'bg-now/20 text-ink border-now' },
  { key: 'past_final', label: 'مكرر فاينل', cls: 'bg-brand/15 text-brand border-brand' },
  { key: 'simplified', label: 'ملخص مبسط', cls: 'bg-line text-ink border-line' },
];
