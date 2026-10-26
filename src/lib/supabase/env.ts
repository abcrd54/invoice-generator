// Mendukung key format baru (sb_publishable_ / sb_secret_) dan nama lama (anon / service_role).
// NEXT_PUBLIC_* harus ditulis literal agar di-inline Next.js ke bundle browser.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

/** Hanya untuk server. */
export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY belum diatur');
  return key;
}
