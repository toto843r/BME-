// ============================================================
//  إعدادات السعي. تعديل المواد الباقية يتم هنا فقط.
//  السعي الكلي = المد (10) + السعي التكويني (40) = 50
//  مجموع قيم max داخل السعي التكويني لكل مادة لازم يكون 40.
// ============================================================
export interface Part { key: string; ar: string; max: number }

export const MIDTERM: Part = { key: 'midterm', ar: 'المد (الامتحان الفصلي)', max: 10 };

// أي مادة غير مذكورة تحت: درجة واحدة من 40 بدون تقسيم.
export const DEFAULT_FORMATIVE: Part[] = [{ key: 'formative', ar: 'السعي التكويني', max: 40 }];

// مفتاح كل مادة = نفس slug الموجود في lib/courses.ts
export const FORMATIVE: Record<string, Part[]> = {
  'medical-measurements': [
    { key: 'attendance', ar: 'الحضور', max: 5 },
    { key: 'reports', ar: 'التقارير', max: 5 },
    { key: 'quizzes', ar: 'الكوزات', max: 10 },
    { key: 'competition', ar: 'المسابقة', max: 10 },
    { key: 'project', ar: 'المشروع', max: 10 },
  ],
  // مثال لمادة ثانية (احذف // وعدّل الأرقام):
  // 'control-systems': [
  //   { key: 'quizzes', ar: 'الكوزات', max: 15 },
  //   { key: 'homework', ar: 'الواجبات', max: 25 },
  // ],
};

export const formativeFor = (slug: string): Part[] => FORMATIVE[slug] ?? DEFAULT_FORMATIVE;
