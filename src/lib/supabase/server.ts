import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseSecretKey } from './env';

/** Client dengan sesi user (cookie) — untuk Server Component & Route Handler. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // dipanggil dari Server Component: abaikan, proxy yang me-refresh sesi
        }
      },
    },
  });
}

/** Client service role — bypass RLS. Hanya dipakai di server setelah autentikasi dicek. */
export function createAdminClient() {
  return createClient(SUPABASE_URL, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
