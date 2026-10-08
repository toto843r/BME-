import { createClient } from '@supabase/supabase-js';
// SERVER ONLY. Never import this from a 'use client' file.
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
