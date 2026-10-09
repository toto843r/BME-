import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
const ALLOWED = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'ppt', 'pptx'];
const MAX = 30 * 1024 * 1024;

export async function POST(req: Request) {
  // Signed upload tokens must not be minted by cross-site browser requests.
  // This is defense in depth; deployment-wide rate limiting should also be
  // configured at the edge if anonymous uploads become a target for spam.
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(req.url).origin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  const ext = String(body.filename || '').split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED.includes(ext)) return NextResponse.json({ error: 'صيغة غير مسموحة' }, { status: 400 });
  if (!(Number(body.size) > 0 && Number(body.size) <= MAX)) return NextResponse.json({ error: 'الحجم غير مسموح' }, { status: 400 });

  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from('materials').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'تعذر تجهيز الرفع' }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
