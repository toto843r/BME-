# بوابة الهندسة الطبية – المرحلة الرابعة

Next.js 14 + Tailwind + Supabase، جاهزة للنشر على Vercel. RTL، وضع داكن، PWA.

## الخطوة 1: إنشاء مشروع Supabase (مجاني)
1. ادخل supabase.com وسجّل بحساب GitHub أو بريدك → **New project**.
2. اختر اسماً وكلمة مرور قوية للقاعدة (احفظها) وأقرب منطقة (مثلاً Frankfurt) → **Create**. انتظر دقيقة.
3. من القائمة اليسرى: **SQL Editor → New query**، افتح ملف `supabase/schema.sql` من المشروع، انسخ كل محتواه والصقه، ثم **Run**. يجب أن تظهر «Success».
4. للتأكد: **Table Editor** فيه جدولان `items` و`reports`، و**Storage** فيه bucket اسمه `materials`.
5. من **Project Settings → API** انسخ:
   - `Project URL`
   - `anon public` key
   - `service_role` key (سرّي، لا تشاركه ولا تضعه في أي مكان عام)

## الخطوة 2: تعديل جدول المحاضرات
افتح `lib/schedule.ts`. البيانات الموجودة **أمثلة فقط**؛ استبدلها بجدول شعبة A وB الحقيقي (اليوم 0=الأحد … 4=الخميس، والوقت بصيغة 24 ساعة).

## الخطوة 3: رفع المشروع إلى GitHub
1. ادخل github.com → **New repository** (اسم مثل `bme-portal`، Private أو Public).
2. اضغط **uploading an existing file**، اسحب **محتويات** مجلد المشروع (ليس ملف zip نفسه) → **Commit changes**.
   - لا ترفع ملف `.env.local` أبداً.

## الخطوة 4: النشر على Vercel (مجاني)
1. ادخل vercel.com وسجّل بحساب GitHub → **Add New → Project** → اختر المستودع → **Import**.
2. قبل الضغط على Deploy افتح **Environment Variables** وأضف أربعة متغيرات:

| الاسم | القيمة |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `ADMIN_PIN` | رمز طويل (8 خانات أو أكثر) تختاره أنت |

3. **Deploy**. بعد دقيقتين يظهر لك رابط عام مثل `https://bme-portal.vercel.app`.
4. أي تعديل لاحق على GitHub يُنشر تلقائياً.

## الاستخدام
- **رفع ملف:** صفحة `/upload`. الملفات تدخل حالة `pending`.
- **المشرف:** صفحة `/admin` ثم أدخل `ADMIN_PIN`. من هناك: قبول (مع اختيار الشارات: مهم جداً / مكرر فاينل / ملخص مبسط)، رفض (يحذف الملف من التخزين)، ومعالجة البلاغات.
- **رفعك أنت للمحتوى الرسمي:** ارفعه من `/upload` ثم اقبله من `/admin`.
- **تثبيت التطبيق:** Android/Chrome يظهر زر «تثبيت». iPhone/Safari: زر المشاركة ← «إضافة إلى الشاشة الرئيسية».

## التشغيل المحلي (اختياري)
```
cp .env.example .env.local   # عبّئ القيم
npm install
npm run dev
```

## ملاحظات أمنية
- القراءة العامة تُظهر `approved` فقط (RLS). ملفات `pending` رابطها مخفي لكن الـ bucket عام، فمن يعرف الرابط الكامل يفتحه.
- الرفع العام يمر عبر رابط رفع لمرة واحدة يصدره `/api/upload/sign` بعد فحص الصيغة والحجم (30MB) وبقيود الـ bucket.
- قفل PIN بسيط يُحجب بعد 5 محاولات فاشلة لكل IP (على مستوى النسخة). استخدم PIN طويلاً.
- على iPhone، معاينة PDF داخل النافذة قد تعرض الصفحة الأولى فقط؛ زر «فتح في تبويب جديد» يحل ذلك.
