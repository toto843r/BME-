import { createClient } from '@supabase/supabase-js';

// Fallbacks only prevent a crash during build if env vars are missing.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key',
);

export const BUCKET = 'materials';
export const fileUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
export const downloadUrl = (path: string, name?: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(path, { download: name || true }).data.publicUrl;
